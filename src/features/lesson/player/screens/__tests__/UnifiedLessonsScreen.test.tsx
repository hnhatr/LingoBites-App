import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@/test-support';
import {AppThemeProvider} from '@ui/theme/index';
import {trackEvent} from '@features/analytics';
import {
  UnifiedLessonCatalogView,
  UnifiedLessonsScreen,
} from '../UnifiedLessonsScreen';
import type {UseLessonCatalogResult} from '../../logic/useLessonCatalog';
import type {UnifiedLessonSummary} from '../../logic/lessonCatalogClient';

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

const tracked = trackEvent as jest.Mock;

const ITEM_A: UnifiedLessonSummary = {
  id: '00000000-0000-4000-8000-000000000010',
  title: 'Global lesson',
  description: 'Admin authored',
  estimatedMinutes: 7,
  contentRevision: 3,
  updatedAt: '2026-09-25T10:00:00.000Z',
};

const ITEM_B: UnifiedLessonSummary = {
  id: '00000000-0000-4000-8000-000000000011',
  title: 'Personal lesson',
  description: 'AI generated',
  estimatedMinutes: null,
  contentRevision: 1,
  updatedAt: '2026-09-25T11:00:00.000Z',
};

function renderWithTheme(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function readyCatalog(
  overrides: Partial<UseLessonCatalogResult> = {},
): UseLessonCatalogResult {
  return {
    status: 'ready',
    items: [ITEM_A, ITEM_B],
    hasMore: false,
    refresh: jest.fn(),
    loadMore: jest.fn(),
    ...overrides,
  } as UseLessonCatalogResult;
}

beforeEach(() => {
  tracked.mockClear();
});

describe('UnifiedLessonCatalogView', () => {
  it('renders mixed-origin summaries in one flat list without sections', () => {
    const onOpenLesson = jest.fn();
    const tree = renderWithTheme(
      <UnifiedLessonCatalogView
        items={[ITEM_A, ITEM_B]}
        hasMore={false}
        refreshing={false}
        onOpenLesson={onOpenLesson}
        onLoadMore={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    expect(
      tree.root.findByProps({testID: 'unified-lessons-list'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        testID: `unified-lesson-title-${ITEM_A.id}`,
      }).props.children,
    ).toBe('Global lesson');
    expect(
      tree.root.findByProps({
        testID: `unified-lesson-title-${ITEM_B.id}`,
      }).props.children,
    ).toBe('Personal lesson');
    expect(
      tree.root.findAllByProps({testID: 'unified-lessons-more'}),
    ).toHaveLength(0);
  });

  it('opens every item through the same callback with the lesson id', () => {
    const onOpenLesson = jest.fn();
    const tree = renderWithTheme(
      <UnifiedLessonCatalogView
        items={[ITEM_A, ITEM_B]}
        hasMore={false}
        refreshing={false}
        onOpenLesson={onOpenLesson}
        onLoadMore={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    act(() => {
      tree.root
        .findByProps({testID: `unified-lesson-item-${ITEM_A.id}`})
        .props.onPress();
      tree.root
        .findByProps({testID: `unified-lesson-item-${ITEM_B.id}`})
        .props.onPress();
    });
    expect(onOpenLesson).toHaveBeenNthCalledWith(1, ITEM_A.id);
    expect(onOpenLesson).toHaveBeenNthCalledWith(2, ITEM_B.id);
  });

  it('shows an empty state when the catalog has no lessons', () => {
    const tree = renderWithTheme(
      <UnifiedLessonCatalogView
        items={[]}
        hasMore={false}
        refreshing={false}
        onOpenLesson={jest.fn()}
        onLoadMore={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    expect(
      tree.root.findByProps({testID: 'unified-lessons-empty'}),
    ).toBeDefined();
  });
});

describe('UnifiedLessonsScreen', () => {
  it('shows a loading state while the first page loads', () => {
    const tree = renderWithTheme(
      <UnifiedLessonsScreen
        catalog={
          {status: 'loading', items: []} as unknown as UseLessonCatalogResult
        }
      />,
    );
    expect(
      tree.root.findByProps({testID: 'unified-lessons-loading'}),
    ).toBeDefined();
  });

  it('shows an error state with retry when loading fails with no items', () => {
    const refresh = jest.fn();
    const tree = renderWithTheme(
      <UnifiedLessonsScreen
        catalog={
          {
            status: 'error',
            items: [],
            error: {message: 'Network connection lost.'},
            refresh,
            loadMore: jest.fn(),
          } as unknown as UseLessonCatalogResult
        }
      />,
    );
    expect(
      tree.root.findByProps({testID: 'unified-lessons-error'}),
    ).toBeDefined();
    act(() => {
      tree.root.findByProps({testID: 'unified-lessons-retry'}).props.onPress();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders the list and emits one catalog-opened breadcrumb', () => {
    const onOpenLesson = jest.fn();
    const tree = renderWithTheme(
      <UnifiedLessonsScreen
        catalog={readyCatalog()}
        onOpenLesson={onOpenLesson}
      />,
    );
    expect(
      tree.root.findByProps({testID: 'unified-lessons-content'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'unified-lessons-list'}),
    ).toBeDefined();
    expect(tracked).toHaveBeenCalledWith('unified_catalog_opened', {
      item_count: 2,
    });
    act(() => {
      tree.root
        .findByProps({testID: `unified-lesson-item-${ITEM_B.id}`})
        .props.onPress();
    });
    expect(onOpenLesson).toHaveBeenCalledWith(ITEM_B.id);
  });
});
