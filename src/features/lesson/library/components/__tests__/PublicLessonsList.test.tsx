import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {PublicLessonsList} from '../PublicLessonsList';

const mockRefresh = jest.fn();
const mockLoadMore = jest.fn();
let mockState: Record<string, unknown> = {status: 'idle'};
const mockUseCanonicalCatalog = jest.fn();

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('@features/lesson/player', () => ({
  useCanonicalCatalog: (filter: unknown) => {
    mockUseCanonicalCatalog(filter);
    return {state: mockState, refresh: mockRefresh, loadMore: mockLoadMore};
  },
  listDownloadedLessonSummaries: () => [{lessonId: 'downloaded'}],
}));

const item = (id: string, title: string, description = '') => ({
  id,
  title,
  description,
  origin: 'admin',
  source_type: 'youtube',
  content_revision: 1,
  sentence_count: 8,
  youtube_video_id: 'abc',
  unit: null,
  updated_at: '2026-10-06T00:00:00.000Z',
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

const renderList = (searchQuery = '') =>
  render(
    <PublicLessonsList
      origin="admin"
      sourceType="youtube"
      searchQuery={searchQuery}
    />,
  );

describe('PublicLessonsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = {
      status: 'ready',
      lessons: [
        item('downloaded', 'Daily English', 'Talk about your day'),
        item('fresh', 'Travel phrases'),
      ],
      nextCursor: null,
      loadingMore: false,
    };
  });

  it('asks the catalog for the section’s origin and source type', () => {
    renderList();
    expect(mockUseCanonicalCatalog).toHaveBeenCalledWith({
      origin: 'admin',
      sourceType: 'youtube',
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('marks lessons already on the phone as downloaded', () => {
    const tree = renderList();
    const texts = (id: string) =>
      tree.root
        .findByProps({testID: `public-lesson-${id}`})
        .findAllByProps({children: 'Đã tải'});
    expect(texts('downloaded').length).toBeGreaterThan(0);
    expect(texts('fresh')).toHaveLength(0);
  });

  it('opens a lesson through app navigation', () => {
    const tree = renderList();
    act(() => {
      tree.root.findByProps({testID: 'public-lesson-fresh'}).props.onPress();
    });
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('fresh');
  });

  it('filters the loaded lessons by the search text', () => {
    const tree = renderList('travel');
    expect(
      tree.root.findAllByProps({testID: 'public-lesson-fresh'}).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({testID: 'public-lesson-downloaded'}),
    ).toHaveLength(0);
  });

  it('shows a retryable error when the catalog cannot load', () => {
    mockState = {status: 'error', error: {message: 'offline'}};
    const tree = renderList();
    expect(
      tree.root.findByProps({testID: 'public-lessons-error'}),
    ).toBeDefined();
    act(() => {
      tree.root.findByProps({testID: 'public-lessons-retry'}).props.onPress();
    });
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state when nothing is public yet', () => {
    mockState = {
      status: 'ready',
      lessons: [],
      nextCursor: null,
      loadingMore: false,
    };
    const tree = renderList();
    expect(
      tree.root.findByProps({testID: 'empty-state-message-public'}),
    ).toBeDefined();
  });

  it('loads the next page near the end of the list', () => {
    mockState = {
      status: 'ready',
      lessons: [item('a', 'A')],
      nextCursor: 'next',
      loadingMore: false,
    };
    const tree = renderList();
    act(() => {
      tree.root
        .findByProps({testID: 'public-lessons-list'})
        .props.onEndReached();
    });
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });
});
