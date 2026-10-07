import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {LessonsHistoryScreen} from '../LessonsHistoryScreen';

const mockRefresh = jest.fn();

let mockCounts: Record<string, number> = {};

jest.mock('../../logic/useLibraryCounts', () => ({
  useLibraryCounts: () => ({counts: mockCounts, refresh: mockRefresh}),
}));

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('LessonsHistoryScreen (Library hub)', () => {
  const navigation = {navigate: jest.fn()} as any;
  const route = {
    key: 'LessonsList',
    name: 'LessonsList' as const,
    params: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCounts = {
      mine: 2,
      video: 1,
      vocabulary: 1,
      grammar: 0,
      public: 0,
      publicVideo: 0,
    };
  });

  const renderHub = () =>
    render(<LessonsHistoryScreen navigation={navigation} route={route} />);
  const count = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
    tree.root.findByProps({testID: `library-card-${id}-count`}).props.children;

  it('shows one card per section, with no tab bar', () => {
    const tree = renderHub();
    ['mine', 'video', 'vocabulary', 'grammar', 'public', 'publicVideo'].forEach(
      id => {
        expect(
          tree.root.findByProps({testID: `library-card-${id}`}),
        ).toBeDefined();
      },
    );
    expect(tree.root.findAllByProps({testID: 'library-tab-bar'})).toHaveLength(
      0,
    );
  });

  it('splits the hub into "Của tôi" and "Khám phá"', () => {
    const tree = renderHub();
    const has = (group: string, id: string) =>
      tree.root
        .findByProps({testID: `library-group-${group}`})
        .findAllByProps({testID: `library-card-${id}`}).length > 0;
    expect(has('mine', 'video')).toBe(true);
    expect(has('mine', 'publicVideo')).toBe(false);
    expect(has('explore', 'publicVideo')).toBe(true);
    expect(has('explore', 'video')).toBe(false);
  });

  it('shows each section count with its unit', () => {
    const tree = renderHub();
    expect(count(tree, 'mine')).toBe('2 bài');
    expect(count(tree, 'video')).toBe('1 bài');
    expect(count(tree, 'vocabulary')).toBe('1 từ');
  });

  it('marks public cards as needing a connection', () => {
    const tree = renderHub();
    expect(count(tree, 'public')).toBe('Cần kết nối mạng');
    expect(count(tree, 'publicVideo')).toBe('Cần kết nối mạng');
  });

  it('shows an action hint on an empty section', () => {
    const tree = renderHub();
    expect(count(tree, 'grammar')).toBe('Bấm ♡ trong bài học để lưu quy tắc');
  });

  it('opens the section list when a card is pressed', () => {
    const tree = renderHub();
    act(() => {
      tree.root.findByProps({testID: 'library-card-video'}).props.onPress();
    });
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith('video');
  });

  it('does not reload library data again on the first focus', () => {
    mockRefresh.mockClear();
    renderHub();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('opens the create-lesson hub from the call to action', () => {
    const tree = renderHub();
    act(() => {
      tree.root.findByProps({testID: 'library-create-lesson'}).props.onPress();
    });
    expect(mockAppNavigation.openCreate).toHaveBeenCalledTimes(1);
  });
});
