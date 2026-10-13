import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {LessonsHistoryScreen} from '../LessonsHistoryScreen';

jest.mock('../../components/tabs/CreatedTab', () => ({
  CreatedTab: () => null,
}));

jest.mock('../../components/tabs/ExploreTab', () => ({
  ExploreTab: () => null,
}));

jest.mock('../../components/tabs/SavedTab', () => ({
  SavedTab: () => null,
}));

jest.mock('../../components/tabs/MomentsTab', () => ({
  MomentsTab: () => null,
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
  });

  const renderHub = () =>
    render(<LessonsHistoryScreen navigation={navigation} route={route} />);
  const byId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
    tree.root.findAllByProps({testID: id});
  const press = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
    act(() => {
      tree.root.findByProps({testID: id}).props.onPress();
    });

  it('shows four icon tabs and opens "Khám phá" first', () => {
    const tree = renderHub();
    ['explore', 'saved', 'created', 'moments'].forEach(tab => {
      expect(byId(tree, `library-tab-${tab}`)).not.toHaveLength(0);
    });
    expect(
      tree.root.findByProps({testID: 'library-tab-explore'}).props
        .accessibilityState,
    ).toEqual({selected: true});
    expect(
      tree.root.findByProps({testID: 'library-tab-title'}).props.children,
    ).toBe('Khám phá');
  });

  it('has no create-lesson button in the header', () => {
    const tree = renderHub();
    expect(byId(tree, 'library-create-lesson')).toHaveLength(0);
  });

  it('only mounts a tab once it is opened', () => {
    const tree = renderHub();
    expect(byId(tree, 'library-panel-explore')).not.toHaveLength(0);
    expect(byId(tree, 'library-panel-saved')).toHaveLength(0);
    press(tree, 'library-tab-saved');
    expect(byId(tree, 'library-panel-saved')).not.toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'library-tab-title'}).props.children,
    ).toBe('Đã lưu');
  });

  it('keeps a visited tab mounted but hidden', () => {
    const tree = renderHub();
    press(tree, 'library-tab-moments');
    const explore = tree.root.findByProps({testID: 'library-panel-explore'});
    expect(explore.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({display: 'none'})]),
    );
  });

  it('gives each icon tab its name for screen readers', () => {
    const tree = renderHub();
    expect(
      tree.root.findByProps({testID: 'library-tab-created'}).props
        .accessibilityLabel,
    ).toBe('Bài tôi tạo');
  });
});
