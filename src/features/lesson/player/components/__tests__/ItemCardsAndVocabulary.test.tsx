import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {LessonBlock} from '@core/schemas/lesson';

import type {LessonVocabularyEntry} from '../../logic/lessonHubContent';
import {type BlockItemLookup, CanonicalBlockView} from '../CanonicalBlockView';
import {LessonVocabularySection} from '../LessonVocabularySection';

const WORD_ID = '44444444-4444-4444-8444-444444444401';
const PATTERN_ID = '44444444-4444-4444-8444-444444444402';

function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{element}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

function collectText(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

const textOf = (tree: ReactTestRenderer.ReactTestRenderer, id: string) => {
  const host = byTestId(tree, id).find(node => typeof node.type === 'string');
  return host ? collectText(host) : '';
};

describe('CanonicalBlockView item cards', () => {
  const block: LessonBlock = {
    id: '22222222-2222-4222-8222-222222222202',
    type: 'item_cards',
    position: 0,
    title: 'Đồ uống',
    data: {item_ids: [WORD_ID, PATTERN_ID, 'missing']},
  };
  const items: BlockItemLookup = new Map([
    [
      WORD_ID,
      {text: 'coffee', meaning_vi: 'cà phê', kind: 'word', payload: {}},
    ],
    [
      PATTERN_ID,
      {
        text: 'Can I have a {drink}?',
        meaning_vi: 'Cho tôi…',
        kind: 'pattern',
        payload: {slots: {drink: {label_vi: 'đồ uống', values: ['tea']}}},
      },
    ],
  ]);

  it('shows each known item as a card with its kind', () => {
    const onSpeakText = jest.fn();
    const tree = render(
      <CanonicalBlockView
        block={block}
        items={items}
        onSpeakText={onSpeakText}
      />,
    );
    expect(
      textOf(tree, `canonical-block-item_cards-item-${WORD_ID}`),
    ).toContain('coffee');
    expect(
      textOf(tree, `canonical-block-item_cards-item-${PATTERN_ID}`),
    ).toContain('Can I have a đồ uống?');
    expect(
      textOf(tree, `canonical-block-item_cards-item-${PATTERN_ID}`),
    ).toContain('Mẫu câu');
    expect(
      byTestId(tree, 'canonical-block-item_cards-item-missing'),
    ).toHaveLength(0);
    const speak = byTestId(
      tree,
      `canonical-block-item_cards-speak-${WORD_ID}`,
    ).find(node => typeof node.props.onPress === 'function')!;
    act(() => speak.props.onPress());
    expect(onSpeakText).toHaveBeenCalledWith('coffee');
    expect(
      byTestId(tree, `canonical-block-item_cards-speak-${PATTERN_ID}`),
    ).toHaveLength(0);
  });
});

describe('LessonVocabularySection groups', () => {
  const entry = (
    key: string,
    role: LessonVocabularyEntry['role'],
    introduction: LessonVocabularyEntry['introduction'],
  ): LessonVocabularyEntry => ({
    key,
    itemId: null,
    word: key.split(':')[1]!,
    meaning: 'nghĩa',
    ipa: null,
    pos: null,
    role,
    introduction,
  });

  const has = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
    byTestId(tree, id).length > 0;
  const press = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
    act(() => {
      byTestId(tree, id)
        .find(node => typeof node.props.onPress === 'function')!
        .props.onPress();
    });

  it('splits catalog items into "Cần nhớ" and "Mở rộng" tabs', () => {
    const tree = render(
      <LessonVocabularySection
        entries={[
          entry('word:coffee', 'required', 'new'),
          entry('word:tea', 'extended', 'recycled'),
        ]}
      />,
    );
    expect(has(tree, 'lesson-vocabulary-word:coffee')).toBe(true);
    expect(has(tree, 'lesson-vocabulary-word:tea')).toBe(false);
    expect(JSON.stringify(tree.toJSON())).toContain('Cần nhớ');
    press(tree, 'lesson-vocabulary-group-extended');
    expect(has(tree, 'lesson-vocabulary-word:tea')).toBe(true);
    // The back of the card names how the lesson introduces the word.
    expect(JSON.stringify(tree.toJSON())).toContain('Ôn lại');
  });

  it('keeps one deck for a learner-made lesson', () => {
    const tree = render(
      <LessonVocabularySection entries={[entry('word:coffee', null, null)]} />,
    );
    expect(has(tree, 'lesson-vocabulary-group-required')).toBe(false);
    expect(has(tree, 'lesson-vocabulary-word:coffee')).toBe(true);
  });

  it('flips a card and moves through the words', () => {
    const onFinish = jest.fn();
    const onToggle = jest.fn();
    const tree = render(
      <LessonVocabularySection
        entries={[
          entry('word:coffee', null, null),
          entry('word:tea', null, null),
        ]}
        onFinish={onFinish}
        onSpeakText={jest.fn()}
        saveControl={{isSaved: () => false, onToggle}}
      />,
    );
    const card = 'lesson-vocabulary-word:coffee';
    expect(
      byTestId(tree, `${card}-flip`)[0]!.props.accessibilityLabel,
    ).toContain('Chạm để xem nghĩa');
    press(tree, `${card}-flip`);
    expect(byTestId(tree, `${card}-flip`)[0]!.props.accessibilityLabel).toBe(
      'coffee: nghĩa. Chạm để xem mặt trước',
    );
    // Save and listen are on both faces.
    press(tree, 'lesson-vocabulary-save-word:coffee-back');
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({id: 'word:coffee', word: 'coffee'}),
    );
    expect(has(tree, 'lesson-vocabulary-speak-word:coffee')).toBe(true);
    press(tree, 'lesson-vocabulary-next');
    expect(has(tree, card)).toBe(false);
    // A new word starts on its front.
    expect(
      byTestId(tree, 'lesson-vocabulary-word:tea-flip')[0]!.props
        .accessibilityLabel,
    ).toContain('Chạm để xem nghĩa');
    press(tree, 'lesson-vocabulary-done');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
