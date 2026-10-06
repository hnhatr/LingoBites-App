import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {LessonsHistoryScreen} from '../LessonsHistoryScreen';

const mockRefresh = jest.fn();

jest.mock('../../logic/useLibrarySegments', () => ({
  ...jest.requireActual('../../logic/useLibrarySegments'),
  useLibrarySegments: () => ({
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
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
    useNavigation: () => ({
      navigate: jest.fn(),
    }),
  };
});

jest.mock('@features/lesson/player', () => {
  const actual = jest.requireActual('@features/lesson/player');
  return {
    ...actual,
    UnifiedLessonsScreen: () => null,
    useCanonicalCatalog: () => ({
      state: {
        status: 'ready',
        lessons: [
          {
            id: 'catalog-1',
            title: 'Catalog one',
            description: 'First',
            origin: 'admin',
            source_type: 'admin_text',
            content_revision: 1,
            sentence_count: 3,
            youtube_video_id: null,
            unit: null,
            updated_at: '2026-09-30T04:15:00.000Z',
          },
        ],
        nextCursor: null,
      },
      refresh: jest.fn(),
      loadMore: jest.fn(),
    }),
  };
});

const mockGetDueFlashcards = jest.fn((): unknown[] => [{}, {}]);

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

describe('LessonsHistoryScreen', () => {
  const navigation = {
    navigate: jest.fn(),
    getParent: jest.fn(),
  } as any;

  const route = {
    key: 'LessonsList',
    name: 'LessonsList' as const,
    params: undefined,
  };

  beforeEach(() => {
    mockRefresh.mockClear();
    navigation.navigate.mockClear();
    jest.clearAllMocks();
  });

  it('renders three tabs', () => {
    const tree = render(
      <LessonsHistoryScreen navigation={navigation} route={route} />,
    );

    expect(tree.root.findByProps({testID: 'tab-lessons'})).toBeDefined();
    expect(tree.root.findByProps({testID: 'tab-vocabulary'})).toBeDefined();
    expect(tree.root.findByProps({testID: 'tab-grammar'})).toBeDefined();
  });

  it('starts with lessons tab active', () => {
    const tree = render(
      <LessonsHistoryScreen navigation={navigation} route={route} />,
    );

    expect(
      tree.root.findByProps({testID: 'lessons-tab-content'}),
    ).toBeDefined();
    expect(() =>
      tree.root.findByProps({testID: 'vocabulary-tab-content'}),
    ).toThrow();
  });

  it('switches to vocabulary tab', () => {
    const tree = render(
      <LessonsHistoryScreen navigation={navigation} route={route} />,
    );

    const vocabularyTab = tree.root.findByProps({testID: 'tab-vocabulary'});

    act(() => {
      vocabularyTab.props.onPress();
    });

    expect(
      tree.root.findByProps({testID: 'vocabulary-tab-content'}),
    ).toBeDefined();
    expect(() =>
      tree.root.findByProps({testID: 'lessons-tab-content'}),
    ).toThrow();
  });

  it('switches to grammar tab', () => {
    const tree = render(
      <LessonsHistoryScreen navigation={navigation} route={route} />,
    );

    const grammarTab = tree.root.findByProps({testID: 'tab-grammar'});

    act(() => {
      grammarTab.props.onPress();
    });

    expect(
      tree.root.findByProps({testID: 'grammar-tab-content'}),
    ).toBeDefined();
  });

  it('refreshes segment data on focus', () => {
    render(<LessonsHistoryScreen navigation={navigation} route={route} />);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('shows the practice entry row above the segments', () => {
    const tree = render(
      <LessonsHistoryScreen navigation={navigation} route={route} />,
    );

    expect(
      tree.root.findByProps({testID: 'library-practice-row'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'library-practice-review'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'library-practice-speaking'}),
    ).toBeDefined();
  });

  it('opens the full catalog from the "Xem tất cả" section action', () => {
    const tree = render(
      <LessonsHistoryScreen navigation={navigation} route={route} />,
    );

    const target = tree.root
      .findAll(node => node.props.testID === 'library-catalog-view-all')
      .find(node => typeof node.props.onPress === 'function');
    if (!target) {
      throw new Error('No pressable found for library-catalog-view-all');
    }
    act(() => target.props.onPress());

    expect(mockAppNavigation.openCatalog).toHaveBeenCalledTimes(1);
  });

  it('routes practice chips to DailyReview and SpeakingRoom', () => {
    const tree = render(
      <LessonsHistoryScreen navigation={navigation} route={route} />,
    );

    const press = (testID: string) => {
      const target = tree.root
        .findAll(node => node.props.testID === testID)
        .find(node => typeof node.props.onPress === 'function');
      if (!target) throw new Error(`No pressable found for ${testID}`);
      act(() => target.props.onPress());
    };

    press('library-practice-review');
    expect(mockAppNavigation.openReview).toHaveBeenCalledTimes(1);
    press('library-practice-speaking');
    expect(mockAppNavigation.openSpeakingRoom).toHaveBeenCalledTimes(1);
  });
});
