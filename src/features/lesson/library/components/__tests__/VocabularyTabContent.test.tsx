import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import type {FlashcardRecord} from '@core/db/types';
import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {VocabularyTabContent} from '../VocabularyTabContent';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock useBookmarkOptimistic
const mockOnVocabularySave = jest.fn();
const mockOnVocabularyUnsave = jest.fn();
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
    onVocabularySave: mockOnVocabularySave,
    onVocabularyUnsave: mockOnVocabularyUnsave,
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

const mockFlashcard1: FlashcardRecord = {
  id: 'flashcard-1',
  lessonId: 'lesson-1',
  vocabularyId: 'vocab-1',
  word: 'apple',
  phraseFromText: null,
  wordType: 'noun',
  meaningVi: 'quả táo',
  pronunciationGuideVi: 'a-pun',
  ipa: '/ˈæpəl/',
  cefrLevel: 'A1',
  sourceSentence: 'I eat an apple',
  example: 'She gave me a red apple',
  exampleTranslation: 'Cô ấy cho tôi một quả táo đỏ',
  isSaved: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  revision: 0,
  tombstone: false,
};

const mockFlashcard2: FlashcardRecord = {
  ...mockFlashcard1,
  id: 'flashcard-2',
  vocabularyId: 'vocab-2',
  word: 'banana',
  meaningVi: 'quả chuối',
  example: 'I like eating bananas',
  exampleTranslation: 'Tôi thích ăn chuối',
  isSaved: true,
};

const mockFlashcard3: FlashcardRecord = {
  ...mockFlashcard1,
  id: 'flashcard-3',
  vocabularyId: 'vocab-3',
  word: 'cherry',
  meaningVi: 'quả anh đào',
  example: null,
  exampleTranslation: null,
  isSaved: false,
};

describe('VocabularyTabContent', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAppNavigation.openLesson.mockClear();
    mockOnVocabularySave.mockClear();
    mockOnVocabularyUnsave.mockClear();
  });

  afterEach(() => {
    renderedTrees.splice(0).forEach(tree => {
      act(() => {
        tree.unmount();
      });
    });
  });

  it('renders empty state when vocabulary is empty', () => {
    const tree = render(<VocabularyTabContent vocabulary={[]} />);

    const emptyState = tree.root.findByProps({
      testID: 'empty-state-message-vocabulary',
    });
    expect(emptyState).toBeDefined();
    expect(emptyState.props.children).toBe('Chưa lưu từ vựng nào');
  });

  it('renders FlatList with vocabulary cards', () => {
    const tree = render(
      <VocabularyTabContent vocabulary={[mockFlashcard1, mockFlashcard2]} />,
    );

    const flatList = tree.root.findByProps({testID: 'vocabulary-flat-list'});
    expect(flatList.props.data).toHaveLength(2);
  });

  it('renders vocabulary card items with correct data', () => {
    const tree = render(<VocabularyTabContent vocabulary={[mockFlashcard1]} />);

    const card = tree.root.findByProps({testID: 'vocabulary-card-flashcard-1'});
    expect(card).toBeDefined();
    expect(card.props.flashcard).toEqual(mockFlashcard1);
  });

  it('passes correct isSaved state to VocabularyRowCard', () => {
    const tree = render(
      <VocabularyTabContent vocabulary={[mockFlashcard1, mockFlashcard2]} />,
    );

    const card1 = tree.root.findByProps({
      testID: 'vocabulary-card-flashcard-1',
    });
    expect(card1.props.isSaved).toBe(false);

    const card2 = tree.root.findByProps({
      testID: 'vocabulary-card-flashcard-2',
    });
    expect(card2.props.isSaved).toBe(true);
  });

  it('calls onPress callback when vocabulary card is pressed', () => {
    const tree = render(<VocabularyTabContent vocabulary={[mockFlashcard1]} />);

    const card = tree.root.findByProps({testID: 'vocabulary-card-flashcard-1'});

    act(() => {
      card.props.onPress();
    });

    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('lesson-1');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the source lesson of the pressed card (no FlashcardDetail route)', () => {
    const tree = render(
      <VocabularyTabContent
        vocabulary={[{...mockFlashcard2, lessonId: 'lesson-2'}]}
      />,
    );

    const card = tree.root.findByProps({testID: 'vocabulary-card-flashcard-2'});

    act(() => {
      card.props.onPress();
    });

    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('lesson-2');
  });

  it('handles save callback', () => {
    const tree = render(<VocabularyTabContent vocabulary={[mockFlashcard1]} />);

    const card = tree.root.findByProps({testID: 'vocabulary-card-flashcard-1'});

    act(() => {
      card.props.onSave();
    });

    expect(mockOnVocabularySave).toHaveBeenCalledWith(
      'flashcard-1',
      expect.objectContaining({
        lessonId: 'lesson-1',
        vocabulary: expect.objectContaining({
          id: 'vocab-1',
          word: 'apple',
          meaning_vi: 'quả táo',
        }),
      }),
    );
  });

  it('handles unsave callback', () => {
    const tree = render(<VocabularyTabContent vocabulary={[mockFlashcard1]} />);

    const card = tree.root.findByProps({testID: 'vocabulary-card-flashcard-1'});

    act(() => {
      card.props.onUnsave();
    });

    expect(mockOnVocabularyUnsave).toHaveBeenCalledWith('flashcard-1');
  });

  it('renders multiple vocabulary cards in a list', () => {
    const tree = render(
      <VocabularyTabContent
        vocabulary={[mockFlashcard1, mockFlashcard2, mockFlashcard3]}
      />,
    );

    const flatList = tree.root.findByProps({testID: 'vocabulary-flat-list'});
    expect(flatList.props.data).toHaveLength(3);

    const card1 = tree.root.findByProps({
      testID: 'vocabulary-card-flashcard-1',
    });
    const card2 = tree.root.findByProps({
      testID: 'vocabulary-card-flashcard-2',
    });
    const card3 = tree.root.findByProps({
      testID: 'vocabulary-card-flashcard-3',
    });

    expect(card1.props.flashcard.word).toBe('apple');
    expect(card2.props.flashcard.word).toBe('banana');
    expect(card3.props.flashcard.word).toBe('cherry');
  });

  it('handles flashcards without examples', () => {
    const tree = render(<VocabularyTabContent vocabulary={[mockFlashcard3]} />);

    const card = tree.root.findByProps({testID: 'vocabulary-card-flashcard-3'});
    expect(card.props.flashcard.example).toBeNull();
  });

  it('updates when vocabulary prop changes', () => {
    const tree = render(<VocabularyTabContent vocabulary={[mockFlashcard1]} />);

    let flatList = tree.root.findByProps({testID: 'vocabulary-flat-list'});
    expect(flatList.props.data).toHaveLength(1);

    act(() => {
      tree.update(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <VocabularyTabContent
              vocabulary={[mockFlashcard1, mockFlashcard2, mockFlashcard3]}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    flatList = tree.root.findByProps({testID: 'vocabulary-flat-list'});
    expect(flatList.props.data).toHaveLength(3);
  });

  it('handles large vocabulary lists efficiently', () => {
    const largeVocabularyList: FlashcardRecord[] = Array.from(
      {length: 100},
      (_, i) => ({
        ...mockFlashcard1,
        id: `flashcard-${i}`,
        vocabularyId: `vocab-${i}`,
        word: `word-${i}`,
      }),
    );

    const tree = render(
      <VocabularyTabContent vocabulary={largeVocabularyList} />,
    );

    const flatList = tree.root.findByProps({testID: 'vocabulary-flat-list'});
    expect(flatList.props.data).toHaveLength(100);
  });

  it('uses correct key extractor for FlatList', () => {
    const tree = render(
      <VocabularyTabContent vocabulary={[mockFlashcard1, mockFlashcard2]} />,
    );

    const flatList = tree.root.findByProps({testID: 'vocabulary-flat-list'});
    expect(flatList.props.keyExtractor(mockFlashcard1)).toBe('flashcard-1');
    expect(flatList.props.keyExtractor(mockFlashcard2)).toBe('flashcard-2');
  });

  it('passes save and unsave callbacks to VocabularyRowCard', () => {
    const tree = render(<VocabularyTabContent vocabulary={[mockFlashcard1]} />);

    const card = tree.root.findByProps({testID: 'vocabulary-card-flashcard-1'});
    expect(typeof card.props.onSave).toBe('function');
    expect(typeof card.props.onUnsave).toBe('function');
    expect(typeof card.props.onPress).toBe('function');
  });
});
