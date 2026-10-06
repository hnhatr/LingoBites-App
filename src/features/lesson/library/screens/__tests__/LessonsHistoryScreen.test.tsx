import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {LessonsHistoryScreen} from '../LessonsHistoryScreen';

const mockRefresh = jest.fn();

const card = (id: string, sourceType: string) => ({
  id,
  title: id,
  blurb: '',
  dateLabel: '2026-10-06',
  vocabularyCount: 3,
  durationMin: 2,
  sourceType,
});

let mockLessons = [
  card('a', 'learner_text'),
  card('b', 'learner_ocr'),
  card('c', 'youtube'),
];

jest.mock('../../logic/useLibrarySegments', () => ({
  ...jest.requireActual('../../logic/useLibrarySegments'),
  useLibrarySegments: () => ({
    packagedLessons: mockLessons,
    vocabulary: [{id: 'v1'}],
    grammar: [],
    refresh: mockRefresh,
  }),
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
    mockLessons = [
      card('a', 'learner_text'),
      card('b', 'learner_ocr'),
      card('c', 'youtube'),
    ];
  });

  const renderHub = () =>
    render(<LessonsHistoryScreen navigation={navigation} route={route} />);
  const count = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
    tree.root.findByProps({testID: `library-card-${id}-count`}).props.children;

  it('shows one card per section, with no tab bar', () => {
    const tree = renderHub();
    ['mine', 'video', 'samples', 'vocabulary', 'grammar'].forEach(id => {
      expect(
        tree.root.findByProps({testID: `library-card-${id}`}),
      ).toBeDefined();
    });
    expect(tree.root.findAllByProps({testID: 'library-tab-bar'})).toHaveLength(
      0,
    );
  });

  it('counts each lesson under exactly one card', () => {
    const tree = renderHub();
    expect(count(tree, 'mine')).toBe('2 bài');
    expect(count(tree, 'video')).toBe('1 bài');
    expect(count(tree, 'vocabulary')).toBe('1 từ');
  });

  it('shows an action hint on an empty section', () => {
    const tree = renderHub();
    expect(count(tree, 'samples')).toBe('Chưa tải bài mẫu nào');
    expect(count(tree, 'grammar')).toBe('Bấm ♡ trong bài học để lưu quy tắc');
  });

  it('opens the section list when a card is pressed', () => {
    const tree = renderHub();
    act(() => {
      tree.root.findByProps({testID: 'library-card-video'}).props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('LibraryList', {
      section: 'video',
    });
  });

  it('refreshes library data on focus', () => {
    renderHub();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('opens the create-lesson hub from the call to action', () => {
    const tree = renderHub();
    act(() => {
      tree.root.findByProps({testID: 'library-create-lesson'}).props.onPress();
    });
    expect(mockAppNavigation.openCreate).toHaveBeenCalledTimes(1);
  });
});
