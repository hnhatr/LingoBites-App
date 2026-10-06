import React from 'react';
import {InteractionManager, TextInput} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {LibraryListScreen} from '../LibraryListScreen';

const mockSetLessonsFilter = jest.fn();

const lesson = (id: string, sourceType: string, origin = 'learner') => ({
  id,
  title: `Lesson ${id}`,
  blurb: 'blurb',
  dateLabel: '2026-10-06',
  vocabularyCount: 3,
  durationMin: 2,
  sourceType,
  origin,
});

jest.mock('../../logic/useLibrarySegments', () => ({
  ...jest.requireActual('../../logic/useLibrarySegments'),
  useLibrarySegments: () => ({
    packagedLessons: [
      lesson('own', 'learner_text'),
      lesson('vid', 'youtube'),
      lesson('sample', 'admin_text', 'admin'),
      lesson('adminvid', 'youtube', 'admin'),
    ],
    vocabulary: [],
    grammar: [],
    setLessonsFilter: mockSetLessonsFilter,
    setVocabularyFilter: jest.fn(),
    setGrammarFilter: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

function render(section: 'mine' | 'video' | 'vocabulary') {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <LibraryListScreen
            navigation={{goBack: jest.fn()} as any}
            route={{key: 'k', name: 'LibraryList', params: {section}}}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('LibraryListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Run the post-transition load immediately.
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation(((task: () => void) => {
        task();
        return {then: jest.fn(), done: jest.fn(), cancel: jest.fn()};
      }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lists only the lessons of its section', () => {
    const tree = render('mine');
    expect(
      tree.root.findAllByProps({testID: 'lesson-item-own'}).length,
    ).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'lesson-item-vid'})).toHaveLength(
      0,
    );
    expect(
      tree.root.findAllByProps({testID: 'lesson-item-sample'}),
    ).toHaveLength(0);
  });

  it('has no section header or source chips inside a list', () => {
    const tree = render('video');
    const list = tree.root.findByProps({testID: 'lessons-section-list'});
    expect(list.props.sections[0].title).toBe('');
    expect(tree.root.findAllByProps({testID: 'filter-toggle'})).toHaveLength(0);
  });

  it('keeps public lessons out of the learner’s own video list', () => {
    const tree = render('video');
    expect(
      tree.root.findAllByProps({testID: 'lesson-item-vid'}).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({testID: 'lesson-item-adminvid'}),
    ).toHaveLength(0);
  });

  it('forwards the search text to the segment filter', () => {
    const tree = render('mine');
    act(() => {
      tree.root.findByType(TextInput).props.onChangeText('hello');
    });
    expect(mockSetLessonsFilter).toHaveBeenCalledWith({
      searchQuery: 'hello',
      sourceFilter: 'all',
    });
  });

  it('shows the empty state for an empty vocabulary section', () => {
    const tree = render('vocabulary');
    expect(
      tree.root.findByProps({testID: 'empty-state-message-vocabulary'}),
    ).toBeDefined();
  });

  it('opens a lesson through app navigation', () => {
    const tree = render('mine');
    act(() => {
      tree.root.findByProps({testID: 'lesson-item-own'}).props.onPress();
    });
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('own');
  });
});
