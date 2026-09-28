import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@/test-support';
import {AppThemeProvider} from '@ui/theme/index';
import {UnifiedLessonsPreviewScreen} from '../UnifiedLessonsPreviewScreen';

jest.mock('../../logic/useLessonCatalog', () => ({
  useLessonCatalog: () => ({
    status: 'ready',
    items: [
      {
        id: '00000000-0000-4000-8000-000000000010',
        title: 'Preview lesson',
        description: 'Desc',
        estimatedMinutes: 5,
        contentRevision: 1,
        updatedAt: '2026-09-25T10:00:00.000Z',
      },
    ],
    hasMore: false,
    refresh: jest.fn(),
    loadMore: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
}));

function screenProps() {
  const tabNavigate = jest.fn();
  const navigation = {
    goBack: jest.fn(),
    getParent: jest.fn().mockReturnValue({navigate: tabNavigate}),
  };
  const props = {
    navigation,
    route: {
      key: 'unified-preview',
      name: 'UnifiedLessonsPreview' as const,
      params: undefined,
    },
  } as unknown as React.ComponentProps<typeof UnifiedLessonsPreviewScreen>;
  return {navigation, tabNavigate, props};
}

function renderScreen(
  props: React.ComponentProps<typeof UnifiedLessonsPreviewScreen>,
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <UnifiedLessonsPreviewScreen {...props} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('UnifiedLessonsPreviewScreen (manual verification entry)', () => {
  it('renders the unified catalog and opens items in the canonical route', () => {
    const {navigation, tabNavigate, props} = screenProps();
    const tree = renderScreen(props);

    expect(
      tree.root.findByProps({testID: 'unified-preview-content'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        testID: 'unified-lesson-title-00000000-0000-4000-8000-000000000010',
      }),
    ).toBeDefined();

    act(() => {
      tree.root
        .findByProps({
          testID: 'unified-lesson-item-00000000-0000-4000-8000-000000000010',
        })
        .props.onPress();
    });
    expect(navigation.getParent).toHaveBeenCalled();
    expect(tabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'CurriculumLesson',
      params: {lessonId: '00000000-0000-4000-8000-000000000010'},
    });
  });
});
