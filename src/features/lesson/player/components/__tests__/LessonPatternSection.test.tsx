import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {LessonSnapshotResponseSchema} from '@core/schemas/lesson';

import {collectLessonPatterns} from '../../logic/lessonHubContent';
import {LessonPatternSection} from '../LessonPatternSection';

const KEY = 'pattern:can-i-have';

function patterns() {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures',
        'valid-lesson-snapshot-with-spec-response.json',
      ),
      'utf8',
    ),
  );
  return collectLessonPatterns(LessonSnapshotResponseSchema.parse(raw).lesson);
}

function render(
  props: Partial<React.ComponentProps<typeof LessonPatternSection>>,
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <LessonPatternSection entries={patterns()} {...props} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

const host = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  byTestId(tree, id).find(node => typeof node.type === 'string');

const pressable = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  byTestId(tree, id).find(node => typeof node.props.onPress === 'function')!;

function speakLabel(tree: ReactTestRenderer.ReactTestRenderer): string {
  return pressable(tree, `lesson-pattern-${KEY}-speak`).props
    .accessibilityLabel;
}

describe('LessonPatternSection', () => {
  it('shows the frame with the first value of each slot', () => {
    const tree = render({onSpeakText: jest.fn()});
    expect(speakLabel(tree)).toBe('Nghe: Can I have a small coffee, please?');
    expect(
      pressable(tree, `lesson-pattern-${KEY}-slot-size`).props
        .accessibilityLabel,
    ).toBe('cỡ: small, chạm để đổi');
  });

  it('moves a slot to its next value on tap and wraps around', () => {
    const onSpeakText = jest.fn();
    const tree = render({onSpeakText});
    const slot = () => pressable(tree, `lesson-pattern-${KEY}-slot-size`);
    act(() => slot().props.onPress());
    act(() => slot().props.onPress());
    expect(speakLabel(tree)).toBe('Nghe: Can I have a large coffee, please?');
    act(() => slot().props.onPress());
    act(() => pressable(tree, `lesson-pattern-${KEY}-speak`).props.onPress());
    expect(onSpeakText).toHaveBeenCalledWith(
      'Can I have a small coffee, please?',
    );
  });

  it('lists every value on long press and picks one', () => {
    const tree = render({onSpeakText: jest.fn()});
    expect(byTestId(tree, `lesson-pattern-${KEY}-choices`)).toHaveLength(0);
    act(() =>
      pressable(tree, `lesson-pattern-${KEY}-slot-drink`).props.onLongPress(),
    );
    act(() =>
      pressable(tree, `lesson-pattern-${KEY}-choice-drink-3`).props.onPress(),
    );
    expect(speakLabel(tree)).toBe(
      'Nghe: Can I have a small orange juice, please?',
    );
    expect(byTestId(tree, `lesson-pattern-${KEY}-choices`)).toHaveLength(0);
  });

  it('shows variants, common errors and examples', () => {
    const tree = render({});
    const entry = patterns()[0]!;
    const json = JSON.stringify(tree.toJSON());
    entry.variants.forEach(variant => expect(json).toContain(variant.text));
    entry.errors.forEach(error => {
      expect(
        host(tree, `lesson-pattern-${KEY}-error-${error.code}`),
      ).toBeTruthy();
    });
    expect(json).toContain(entry.examples[0]!.en);
    expect(byTestId(tree, `lesson-pattern-${KEY}-speak`)).toHaveLength(0);
  });

  it('saves the pattern by its item code', () => {
    const onToggle = jest.fn();
    const tree = render({
      saveControl: {isSaved: key => key === 'other', onToggle},
    });
    act(() => pressable(tree, `lesson-pattern-${KEY}-save`).props.onPress());
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({key: KEY, itemId: patterns()[0]!.itemId}),
    );
  });

  it('shows an empty state', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <LessonPatternSection entries={[]} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    expect(byTestId(tree, 'lesson-patterns-empty').length).toBeGreaterThan(0);
  });
});
