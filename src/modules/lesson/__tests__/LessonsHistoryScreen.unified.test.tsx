import * as AuthSession from '@shared/auth/authSession';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@theme';
import {LessonsHistoryScreen} from '../LessonsHistoryScreen';

const mockRefresh = jest.fn();

jest.mock('../useLibrarySegments', () => ({
  useLibrarySegments: () => ({
    personalLessons: [],
    packagedLessons: [],
    vocabulary: [],
    grammar: [],
    lessonsFilter: {searchQuery: '', sourceFilter: 'all'},
    vocabularyFilter: {searchQuery: '', sourceFilter: 'all'},
    grammarFilter: {searchQuery: '', sourceFilter: 'all'},
    setLessonsFilter: jest.fn(),
    setVocabularyFilter: jest.fn(),
    setGrammarFilter: jest.fn(),
    refresh: mockRefresh,
  }),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      React.useEffect(callback, [callback]),
    useNavigation: () => ({
      navigate: jest.fn(),
    }),
  };
});

// Keep the real unified catalog screen, but pin capabilities on so the
// composition under test is deterministic without a live probe.
jest.mock('@modules/curriculumLesson', () => {
  const actual = jest.requireActual('@modules/curriculumLesson');
  return {
    ...actual,
    useLessonServerCapabilities: () => ({
      catalog: true,
      canonicalDelivery: true,
      aiMaterialization: true,
      packagedImport: true,
      partialRetry: true,
      privateLibrary: true,
    }),
  };
});

jest.mock('@modules/analytics', () => ({
  trackEvent: jest.fn(),
}));

const mockGetDueFlashcards = jest.fn(() => []);

jest.mock('../useFlashcardLibrary', () => ({
  useFlashcardLibrary: () => ({
    getDueFlashcards: mockGetDueFlashcards,
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

const CATALOG_PAGE = {
  request_id: 'req-cat',
  status: 'success',
  lessons: [
    {
      id: '00000000-0000-4000-8000-000000000010',
      title: 'Unified one',
      description: 'First',
      estimatedMinutes: 5,
      contentRevision: 1,
      updatedAt: '2026-09-25T10:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-000000000011',
      title: 'Unified two',
      description: 'Second',
      estimatedMinutes: null,
      contentRevision: 1,
      updatedAt: '2026-09-25T11:00:00.000Z',
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

  it('renders one flat canonical catalog instead of source sections', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    let navigation!: {navigate: jest.Mock};
    await act(async () => {
      ({tree, navigation} = renderUnified());
    });
    expect(
      tree.root.findByProps({testID: 'unified-lessons-content'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'unified-lessons-list'}),
    ).toBeDefined();
    expect(() =>
      tree.root.findByProps({testID: 'lessons-section-list'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'curriculum-entry-section'}),
    ).toThrow();

    act(() => {
      tree.root
        .findByProps({
          testID: 'unified-lesson-item-00000000-0000-4000-8000-000000000011',
        })
        .props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('CurriculumLesson', {
      lessonId: '00000000-0000-4000-8000-000000000011',
    });
  });
});
