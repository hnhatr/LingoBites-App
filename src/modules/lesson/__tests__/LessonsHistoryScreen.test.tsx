import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppThemeProvider} from '@theme';
import {FeatureFlagProvider} from '@/release';
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

jest.mock('@modules/curriculumLesson', () => ({
  UnifiedLessonsScreen: () => null,
}));

const mockGetDueFlashcards = jest.fn(() => []);

jest.mock('../useFlashcardLibrary', () => ({
  useFlashcardLibrary: () => ({
    getDueFlashcards: mockGetDueFlashcards,
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
    expect(navigation.navigate).toHaveBeenCalledWith('DailyReview');
    press('library-practice-speaking');
    expect(navigation.navigate).toHaveBeenCalledWith('SpeakingRoom');
  });
});
