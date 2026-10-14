import React from 'react';
import {InteractionManager} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {itemCodeLabel, SavedTab} from '../tabs/SavedTab';

let mockVocabulary: Array<{word: string}> = [];
let mockGrammar: Array<{title?: string; grammarId: string}> = [];
let mockDue: unknown[] = [];
let mockCombos: Array<{itemCode: string}> = [];

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('../../logic/useLibrarySegments', () => ({
  useLibrarySegments: ({vocabulary}: {vocabulary: boolean}) => ({
    vocabulary: vocabulary ? mockVocabulary : [],
    grammar: vocabulary ? mockGrammar : [],
    refresh: jest.fn(),
  }),
  useRefreshOnRefocus: jest.fn(),
}));

jest.mock('@features/review', () => ({
  getDueFlashcards: () => mockDue,
}));

jest.mock('@features/combo', () => ({
  listLocalComboSets: () => mockCombos,
}));

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SavedTab />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const textOf = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findByProps({testID: id}).props.children;

describe('SavedTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task?: any) => {
        task?.();
        return {cancel: jest.fn()} as any;
      });
    mockVocabulary = [
      {word: 'borrow'},
      {word: 'receipt'},
      {word: 'on time'},
      {word: 'apologize'},
      {word: 'queue'},
    ];
    mockGrammar = [{title: 'used to + V', grammarId: 'g1'}];
    mockDue = [{}, {}, {}];
    mockCombos = [{itemCode: 'word:coffee'}];
  });

  it('reads the label out of an item code', () => {
    expect(itemCodeLabel('word:coffee')).toBe('coffee');
    expect(itemCodeLabel('coffee')).toBe('coffee');
  });

  it('shows how many cards are due and opens the review', () => {
    const tree = render();
    expect(textOf(tree, 'library-saved-review-description')).toBe(
      '3 từ đến hạn ôn',
    );
    act(() => {
      tree.root.findByProps({testID: 'library-saved-review'}).props.onPress();
    });
    expect(mockAppNavigation.openReview).toHaveBeenCalledTimes(1);
  });

  it('hides the review when nothing is due', () => {
    mockDue = [];
    const tree = render();
    expect(
      tree.root.findAllByProps({testID: 'library-saved-review'}),
    ).toHaveLength(0);
  });

  it('counts each kind and previews its first items', () => {
    const tree = render();
    expect(textOf(tree, 'library-saved-vocabulary-count')).toBe(5);
    expect(textOf(tree, 'library-saved-grammar-count')).toBe(1);
    expect(textOf(tree, 'library-saved-combos-count')).toBe(1);
    const card = tree.root.findByProps({testID: 'library-saved-vocabulary'});
    const texts = card
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children);
    expect(texts).toContain('apologize');
    expect(texts).not.toContain('queue');
    const combos = tree.root.findByProps({testID: 'library-saved-combos'});
    expect(
      combos.findAll(node => node.props.children === 'coffee').length,
    ).toBeGreaterThan(0);
  });

  it('opens the list of a kind', () => {
    const tree = render();
    act(() => {
      tree.root.findByProps({testID: 'library-saved-grammar'}).props.onPress();
    });
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith(
      'grammar',
    );
  });

  it('shows how to save only when nothing is saved', () => {
    expect(
      render().root.findAllByProps({testID: 'library-saved-hint'}),
    ).toHaveLength(0);
    mockVocabulary = [];
    mockGrammar = [];
    mockCombos = [];
    expect(
      render().root.findAllByProps({testID: 'library-saved-hint'}),
    ).not.toHaveLength(0);
  });
});
