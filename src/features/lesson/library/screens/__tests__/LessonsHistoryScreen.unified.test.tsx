import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import * as AuthSession from '@core/auth/authSession';
import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {LessonsHistoryScreen} from '../LessonsHistoryScreen';

const mockRefresh = jest.fn();
const mockInnerNavigate = jest.fn();
let mockLessonsFilter = {searchQuery: '', sourceFilter: 'all'};

jest.mock('../../logic/useLibrarySegments', () => ({
  ...jest.requireActual('../../logic/useLibrarySegments'),
  useLibrarySegments: () => ({
    packagedLessons: [
      {
        id: '00000000-0000-4000-8000-000000000010',
        title: 'Unified one',
        blurb: 'First',
        dateLabel: '2026-10-06',
        vocabularyCount: 3,
        durationMin: 2,
        sourceType: 'admin_text',
      },
    ],
    vocabulary: [],
    grammar: [],
    lessonsFilter: mockLessonsFilter,
    vocabularyFilter: {searchQuery: '', sourceFilter: 'all'},
    grammarFilter: {searchQuery: '', sourceFilter: 'all'},
    setLessonsFilter: jest.fn(),
    setVocabularyFilter: jest.fn(),
    setGrammarFilter: jest.fn(),
    refresh: mockRefresh,
  }),
}));

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
    useNavigation: () => ({
      navigate: mockInnerNavigate,
    }),
  };
});

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
}));

const mockGetDueFlashcards = jest.fn(() => []);

jest.mock('@features/review', () => ({
  useFlashcardLibrary: () => ({
    getDueFlashcards: mockGetDueFlashcards,
  }),
  useBookmarkOptimistic: () => ({
    vocabularySaveState: {
      isSaved: new Map(),
      getIsSaved: (_itemId: string, dbValue: boolean) => dbValue,
    },
    grammarSaveState: {
      isSaved: new Map(),
      getIsSaved: (_itemId: string, dbValue: boolean) => dbValue,
    },
    onVocabularySave: jest.fn(),
    onVocabularyUnsave: jest.fn(),
    onGrammarSave: jest.fn(),
    onGrammarUnsave: jest.fn(),
  }),
}));

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: 'test-token',
    session_id: '1',
    refresh_token: '2',
    access_expires_at: '2050',
    refresh_expires_at: '2050',
  },
  userId: 'user1',
};

// Canonical contract shape: contract_version + snake_case.
const CATALOG_PAGE = {
  contract_version: 1,
  lessons: [
    {
      id: '00000000-0000-4000-8000-000000000021',
      title: 'Catalog one',
      description: 'First',
      origin: 'admin',
      source_type: 'admin_text',
      content_revision: 1,
      sentence_count: 4,
      youtube_video_id: null,
      unit: null,
      updated_at: '2026-09-30T04:15:00.000Z',
    },
  ],
  next_cursor: null,
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function renderUnified() {
  const navigation = {navigate: jest.fn(), getParent: jest.fn()};
  const route = {
    key: 'LessonsList',
    name: 'LessonsList' as const,
    params: undefined,
  };
  const tree = ReactTestRenderer.create(
    <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
      <AppThemeProvider>
        <LessonsHistoryScreen
          navigation={navigation as never}
          route={route as never}
        />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
  return {tree, navigation};
}

describe('LessonsHistoryScreen unified composition (LING-21 TASK-007)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLessonsFilter = {searchQuery: '', sourceFilter: 'all'};
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CATALOG_PAGE,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders downloaded-lesson list from library segments (TASK-008)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    let navigation!: {navigate: jest.Mock};
    await act(async () => {
      ({tree, navigation} = renderUnified());
    });
    expect(
      tree.root.findByProps({testID: 'lessons-section-list'}),
    ).toBeDefined();
    expect(() =>
      tree.root.findByProps({testID: 'unified-lessons-content'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'curriculum-entry-section'}),
    ).toThrow();

    expect(mockRefresh).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('shows a catalog section under the downloaded lessons in the same tab', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    let navigation!: {navigate: jest.Mock};
    await act(async () => {
      ({tree, navigation} = renderUnified());
    });

    expect(String(mockFetch.mock.calls[0][0])).toContain('/api/v1/lessons');
    expect(() => tree.root.findByProps({testID: 'tab-catalog'})).toThrow();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Đã tải về');
    expect(text).toContain('Tất cả bài học');

    const row = tree.root.findByProps({
      testID: 'lesson-item-00000000-0000-4000-8000-000000000021',
    });
    await act(async () => {
      row.props.onPress();
    });
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000021',
    );

    await act(async () => {
      tree.root
        .findByProps({testID: 'library-catalog-view-all'})
        .props.onPress();
    });
    expect(mockAppNavigation.openCatalog).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('filters the catalog preview by the real source_type', async () => {
    mockLessonsFilter = {searchQuery: '', sourceFilter: 'youtube'};
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      ({tree} = renderUnified());
    });

    expect(
      tree.root.findByProps({testID: 'filter-chip-youtube'}).props.selected,
    ).toBe(true);
    expect(() =>
      tree.root.findByProps({
        testID: 'lesson-item-00000000-0000-4000-8000-000000000021',
      }),
    ).toThrow();
    expect(JSON.stringify(tree.toJSON())).not.toContain('Tất cả bài học');
  });
});
