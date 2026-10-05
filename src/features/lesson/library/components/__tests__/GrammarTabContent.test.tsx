import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import type {GrammarBookmark} from '@core/db/types';
import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {GrammarTabContent} from '../GrammarTabContent';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

const mockOnGrammarSave = jest.fn();
const mockOnGrammarUnsave = jest.fn();

jest.mock('@features/review', () => ({
  useBookmarkOptimistic: jest.fn(() => ({
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
    onGrammarSave: mockOnGrammarSave,
    onGrammarUnsave: mockOnGrammarUnsave,
  })),
}));

const renderedTrees: ReactTestRenderer.ReactTestRenderer[] = [];

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  renderedTrees.push(tree);
  return tree;
}

const mockGrammar1: GrammarBookmark & {title?: string; content?: string} = {
  lessonId: 'lesson-1',
  grammarId: 'grammar-1',
  packageId: 'pkg-1',
  savedAt: '2024-01-01T00:00:00Z',
  reactivatedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  revision: 0,
  tombstone: false,
  title: 'Present Simple',
  content: 'Used for habits and facts',
};

const mockGrammar2: GrammarBookmark & {title?: string; content?: string} = {
  ...mockGrammar1,
  grammarId: 'grammar-2',
  title: 'Past Tense',
  content: 'Describes completed actions',
};

describe('GrammarTabContent', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAppNavigation.openLesson.mockClear();
    mockOnGrammarSave.mockClear();
    mockOnGrammarUnsave.mockClear();
  });

  afterEach(() => {
    renderedTrees.splice(0).forEach(tree => {
      act(() => {
        tree.unmount();
      });
    });
  });

  it('renders empty state when grammar is empty', () => {
    const tree = render(<GrammarTabContent grammar={[]} />);

    const emptyState = tree.root.findByProps({
      testID: 'empty-state-message-grammar',
    });
    expect(emptyState).toBeDefined();
    expect(emptyState.props.children).toBe('Chưa lưu ngữ pháp nào');
  });

  it('renders FlatList with grammar cards', () => {
    const tree = render(
      <GrammarTabContent grammar={[mockGrammar1, mockGrammar2]} />,
    );

    const flatList = tree.root.findByProps({testID: 'grammar-flat-list'});
    expect(flatList.props.data).toHaveLength(2);
  });

  it('renders grammar card items with correct data', () => {
    const tree = render(<GrammarTabContent grammar={[mockGrammar1]} />);

    const card = tree.root.findByProps({testID: 'grammar-card-grammar-1'});
    expect(card).toBeDefined();
    expect(card.props.grammar).toEqual(mockGrammar1);
  });

  it('passes correct isSaved state to GrammarRowCard', () => {
    const tree = render(
      <GrammarTabContent grammar={[mockGrammar1, mockGrammar2]} />,
    );

    const card1 = tree.root.findByProps({testID: 'grammar-card-grammar-1'});
    expect(card1.props.isSaved).toBe(true);

    const card2 = tree.root.findByProps({testID: 'grammar-card-grammar-2'});
    expect(card2.props.isSaved).toBe(true);
  });

  it('opens the source lesson on card press (no GrammarDetail route)', () => {
    const tree = render(<GrammarTabContent grammar={[mockGrammar1]} />);

    const card = tree.root.findByProps({testID: 'grammar-card-grammar-1'});

    act(() => {
      card.props.onPress();
    });

    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('lesson-1');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles save callback', () => {
    const tree = render(<GrammarTabContent grammar={[mockGrammar1]} />);

    const card = tree.root.findByProps({testID: 'grammar-card-grammar-1'});

    act(() => {
      card.props.onSave();
    });

    expect(mockOnGrammarSave).toHaveBeenCalledWith(
      'grammar-1',
      expect.objectContaining({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'pkg-1',
      }),
    );
  });

  it('handles unsave callback', () => {
    const tree = render(<GrammarTabContent grammar={[mockGrammar1]} />);

    const card = tree.root.findByProps({testID: 'grammar-card-grammar-1'});

    act(() => {
      card.props.onUnsave();
    });

    expect(mockOnGrammarUnsave).toHaveBeenCalledWith('grammar-1', 'lesson-1');
  });

  it('uses correct key extractor for FlatList', () => {
    const tree = render(
      <GrammarTabContent grammar={[mockGrammar1, mockGrammar2]} />,
    );

    const flatList = tree.root.findByProps({testID: 'grammar-flat-list'});
    expect(flatList.props.keyExtractor(mockGrammar1)).toBe('grammar-1');
    expect(flatList.props.keyExtractor(mockGrammar2)).toBe('grammar-2');
  });
});
