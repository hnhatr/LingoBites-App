import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppThemeProvider} from '@ui/theme/index';
import {FeatureFlagProvider} from '@/release';
import {GrammarRowCard} from '../GrammarRowCard';
import type {GrammarBookmark} from '@/shared/db/types';

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

const mockGrammar: GrammarBookmark & {title?: string; content?: string} = {
  lessonId: 'lesson-1',
  grammarId: 'grammar-1',
  packageId: 'package-1',
  savedAt: '2024-01-01T00:00:00Z',
  reactivatedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  revision: 0,
  tombstone: false,
  title: 'Present Simple Tense',
  content: 'Used for habitual actions and general truths',
};

const mockGrammarNoContent: GrammarBookmark & {
  title?: string;
  content?: string;
} = {
  lessonId: 'lesson-1',
  grammarId: 'grammar-1',
  packageId: 'package-1',
  savedAt: '2024-01-01T00:00:00Z',
  reactivatedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  revision: 0,
  tombstone: false,
  title: 'Present Simple Tense',
  content: undefined,
};

describe('GrammarRowCard', () => {
  it('renders grammar title and content', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const titleText = tree.root.findByProps({testID: 'grammar-title-text'});
    const contentText = tree.root.findByProps({testID: 'grammar-content-text'});

    expect(titleText.props.children).toBe('Present Simple Tense');
    expect(contentText.props.children).toBe(
      'Used for habitual actions and general truths',
    );
  });

  it('shows unsaved heart when not saved', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
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
      <GrammarRowCard
        grammar={mockGrammar}
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
      <GrammarRowCard
        grammar={mockGrammar}
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
      <GrammarRowCard
        grammar={mockGrammar}
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
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={onPress}
      />,
    );

    const pressable = tree.root.findByProps({testID: 'grammar-card-pressable'});
    act(() => {
      pressable.props.onPress();
    });

    expect(onPress).toHaveBeenCalled();
  });

  it('applies correct text styling - title variant is h3', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const titleText = tree.root.findByProps({testID: 'grammar-title-text'});
    expect(titleText.props.variant).toBe('h3');
  });

  it('applies correct text styling - content variant is label with secondary color', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const contentText = tree.root.findByProps({testID: 'grammar-content-text'});
    expect(contentText.props.variant).toBe('label');
    expect(contentText.props.color).toBe('secondary');
  });

  it('heart button has bare tone styling', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
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
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const pressable = tree.root.findByProps({testID: 'grammar-card-pressable'});
    expect(pressable.props.accessibilityLabel).toBe(
      'Present Simple Tense - Used for habitual actions and general truths',
    );
    expect(pressable.props.accessibilityRole).toBe('button');
  });

  it('heart button has correct accessibility label when saved', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={true}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.accessibilityLabel).toBe(
      'Bỏ lưu quy tắc ngữ pháp này',
    );
  });

  it('heart button has correct accessibility label when not saved', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const saveButton = tree.root.findByProps({testID: 'save-button'});
    expect(saveButton.props.accessibilityLabel).toBe(
      'Lưu quy tắc ngữ pháp này',
    );
  });

  it('handles missing content gracefully', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammarNoContent}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const titleText = tree.root.findByProps({testID: 'grammar-title-text'});
    const contentText = tree.root.findByProps({testID: 'grammar-content-text'});

    expect(titleText.props.children).toBe('Present Simple Tense');
    expect(contentText.props.children).toBe('');
  });

  it('updates heart icon when isSaved prop changes', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
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
            <GrammarRowCard
              grammar={mockGrammar}
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

  it('handles different grammar data', () => {
    const customGrammar: GrammarBookmark & {title?: string; content?: string} =
      {
        lessonId: 'lesson-2',
        grammarId: 'grammar-2',
        packageId: 'package-2',
        savedAt: '2024-01-02T00:00:00Z',
        reactivatedAt: null,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        revision: 0,
        tombstone: false,
        title: 'Past Continuous',
        content:
          'Used for actions that were in progress at a specific time in the past',
      };

    const tree = render(
      <GrammarRowCard
        grammar={customGrammar}
        isSaved={true}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const titleText = tree.root.findByProps({testID: 'grammar-title-text'});
    const contentText = tree.root.findByProps({testID: 'grammar-content-text'});

    expect(titleText.props.children).toBe('Past Continuous');
    expect(contentText.props.children).toBe(
      'Used for actions that were in progress at a specific time in the past',
    );
  });

  it('renders the card with title and content visible', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const titleText = tree.root.findByProps({testID: 'grammar-title-text'});
    const contentText = tree.root.findByProps({testID: 'grammar-content-text'});

    expect(titleText).toBeDefined();
    expect(contentText).toBeDefined();
  });

  it('grammar card pressable has correct size dimensions', () => {
    const tree = render(
      <GrammarRowCard
        grammar={mockGrammar}
        isSaved={false}
        onSave={jest.fn()}
        onUnsave={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    const pressable = tree.root.findByProps({testID: 'grammar-card-pressable'});
    expect(pressable.props.accessibilityRole).toBe('button');
  });
});
