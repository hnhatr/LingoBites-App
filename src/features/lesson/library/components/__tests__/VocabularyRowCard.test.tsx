import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import type {FlashcardRecord} from '@core/db/types';
import {FeatureFlagProvider} from '@core/release';

import {VocabularyRowCard} from '../VocabularyRowCard';

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

const mockFlashcard: FlashcardRecord = {
  id: 'test-id',
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

const mockFlashcardNoExample: FlashcardRecord = {
  ...mockFlashcard,
  example: null,
  exampleTranslation: null,
};

describe('VocabularyRowCard', () => {
  it('renders word and meaning', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const wordText = tree.root.findByProps({testID: 'word-text'});
    const meaningText = tree.root.findByProps({testID: 'meaning-text'});

    expect(wordText.props.children).toBe('apple');
    expect(meaningText.props.children).toBe('quả táo');
  });

  it('shows unsaved heart when not saved', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.icon).toBe('heart_outline');
  });

  it('shows saved heart when saved', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={true}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.icon).toBe('heart');
  });

  it('calls onSave when unsaved heart pressed', () => {
    const onSave = jest.fn();
    const onUnsave = jest.fn();
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={onSave}
        onUnsave={onUnsave}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    act(() => {
      saveButton.props.onPress();
    });

    expect(onSave).toHaveBeenCalled();
    expect(onUnsave).not.toHaveBeenCalled();
  });

  it('calls onUnsave when saved heart pressed', () => {
    const onSave = jest.fn();
    const onUnsave = jest.fn();
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={true}
        onSave={onSave}
        onUnsave={onUnsave}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    act(() => {
      saveButton.props.onPress();
    });

    expect(onUnsave).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={onPress}
      />,
    );

    const pressable = tree.root.findByProps({
      testID: 'vocabulary-card-pressable',
    });
    act(() => {
      pressable.props.onPress();
    });

    expect(onPress).toHaveBeenCalled();
  });

  it('renders example text if present', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const exampleText = tree.root.findByProps({testID: 'example-text'});
    expect(exampleText.props.children).toBe('She gave me a red apple');
  });

  it('does not render example text if not present', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcardNoExample}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const exampleTextResults = tree.root.findAllByProps({
      testID: 'example-text',
    });
    expect(exampleTextResults).toHaveLength(0);
  });

  it('applies correct text styling - word variant is h3', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const wordText = tree.root.findByProps({testID: 'word-text'});
    expect(wordText.props.variant).toBe('h3');
  });

  it('applies correct text styling - meaning variant is label with secondary color', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const meaningText = tree.root.findByProps({testID: 'meaning-text'});
    expect(meaningText.props.variant).toBe('label');
    expect(meaningText.props.color).toBe('secondary');
  });

  it('applies correct text styling - example variant is caption with muted color', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const exampleText = tree.root.findByProps({testID: 'example-text'});
    expect(exampleText.props.variant).toBe('caption');
    expect(exampleText.props.color).toBe('muted');
  });

  it('heart button has bare tone styling', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.tone).toBe('bare');
  });

  it('renders with correct accessibility labels', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const pressable = tree.root.findByProps({
      testID: 'vocabulary-card-pressable',
    });
    expect(pressable.props.accessibilityLabel).toBe('apple - quả táo');
    expect(pressable.props.accessibilityRole).toBe('button');
  });

  it('heart button has correct accessibility label when saved', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={true}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.accessibilityLabel).toBe('Bỏ lưu từ này');
  });

  it('heart button has correct accessibility label when not saved', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.accessibilityLabel).toBe('Lưu từ này');
  });

  it('updates heart icon when isSaved prop changes', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    let saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.icon).toBe('heart_outline');

    act(() => {
      tree.update(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <VocabularyRowCard
              flashcard={mockFlashcard}
              isSaved={true}
              onSave={jest.fn()}
              onUnsave={jest.fn()}
              onPress={jest.fn()}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.icon).toBe('heart');
  });

  it('handles different flashcard data', () => {
    const customFlashcard: FlashcardRecord = {
      id: 'test-id-2',
      lessonId: 'lesson-2',
      vocabularyId: 'vocab-2',
      word: 'book',
      phraseFromText: null,
      wordType: 'noun',
      meaningVi: 'cuốn sách',
      pronunciationGuideVi: 'buk',
      ipa: '/bʊk/',
      cefrLevel: 'A1',
      sourceSentence: 'I read a book',
      example: 'This is an interesting book',
      exampleTranslation: 'Đây là một cuốn sách thú vị',
      isSaved: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      revision: 0,
      tombstone: false,
    };

    const tree = render(
      <VocabularyRowCard
        flashcard={customFlashcard}
        isSaved={true}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const wordText = tree.root.findByProps({testID: 'word-text'});
    const meaningText = tree.root.findByProps({testID: 'meaning-text'});
    const exampleText = tree.root.findByProps({testID: 'example-text'});

    expect(wordText.props.children).toBe('book');
    expect(meaningText.props.children).toBe('cuốn sách');
    expect(exampleText.props.children).toBe('This is an interesting book');
  });

  it('renders the card with word and meaning visible', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const wordText = tree.root.findByProps({testID: 'word-text'});
    const meaningText = tree.root.findByProps({testID: 'meaning-text'});

    expect(wordText).toBeDefined();
    expect(meaningText).toBeDefined();
  });
});

describe('VocabularyRowCard sources and phonetics', () => {
  const sources = [
    {lessonId: 'lesson-a', title: 'Morning routine'},
    {lessonId: 'lesson-b', title: null},
    {lessonId: 'lesson-c', title: 'At the cafe'},
  ];

  it('shows the part of speech and IPA under the word', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );
    expect(
      tree.root.findByProps({testID: 'phonetic-text'}).props.children,
    ).toBe('[noun] /ˈæpəl/');
  });

  it('omits the phonetic line when there is nothing to show', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={{...mockFlashcard, wordType: null, ipa: null}}
        isSaved
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );
    expect(tree.root.findAllByProps({testID: 'phonetic-text'})).toHaveLength(0);
  });

  it('a word from one lesson opens that lesson and shows no source list', () => {
    const onPress = jest.fn();
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={onPress}
        sources={[{lessonId: 'lesson-a', title: 'Morning routine'}]}
      />,
    );
    expect(tree.root.findAllByProps({testID: 'sources-toggle'})).toHaveLength(
      0,
    );
    act(() => {
      tree.root
        .findByProps({testID: 'vocabulary-card-pressable'})
        .props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a word from several lessons toggles its lesson list instead of opening one', () => {
    const onPress = jest.fn();
    const onOpenSource = jest.fn();
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={onPress}
        sources={sources}
        onOpenSource={onOpenSource}
      />,
    );

    const toggle = () => tree.root.findByProps({testID: 'sources-toggle'});
    expect(toggle().props.accessibilityLabel).toBe('Xem 3 bài chứa từ apple');
    expect(toggle().props.accessibilityState).toEqual({expanded: false});
    expect(tree.root.findAllByProps({testID: 'sources-list'})).toHaveLength(0);

    // Tapping the card body opens the list, never an arbitrary lesson.
    act(() => {
      tree.root
        .findByProps({testID: 'vocabulary-card-pressable'})
        .props.onPress();
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(
      tree.root.findAllByProps({testID: 'sources-list'}).length,
    ).toBeGreaterThan(0);
    expect(toggle().props.accessibilityState).toEqual({expanded: true});
    expect(toggle().props.accessibilityLabel).toBe(
      'Ẩn danh sách bài chứa từ apple',
    );

    const rowLabel = (id: string) =>
      tree.root.findByProps({testID: `source-row-${id}`}).props
        .accessibilityLabel;
    expect(rowLabel('lesson-a')).toBe('Mở bài Morning routine');
    expect(rowLabel('lesson-b')).toBe('Mở bài Bài học'); // not downloaded
    act(() => {
      tree.root.findByProps({testID: 'source-row-lesson-c'}).props.onPress();
    });
    expect(onOpenSource).toHaveBeenCalledWith('lesson-c');

    act(() => {
      toggle().props.onPress();
    });
    expect(tree.root.findAllByProps({testID: 'sources-list'})).toHaveLength(0);
  });

  it('the save heart and the source rows are not inside the card button', () => {
    const tree = render(
      <VocabularyRowCard
        flashcard={mockFlashcard}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
        sources={sources}
      />,
    );
    const cardButton = tree.root.findByProps({
      testID: 'vocabulary-card-pressable',
    });
    expect(cardButton.findAllByProps({testID: 'save-button'})).toHaveLength(0);
    expect(cardButton.findAllByProps({testID: 'sources-toggle'})).toHaveLength(
      0,
    );
  });
});
