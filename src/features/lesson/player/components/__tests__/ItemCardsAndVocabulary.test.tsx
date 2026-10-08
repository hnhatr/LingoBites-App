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

  it('splits catalog items into required and extended with intro chips', () => {
    const tree = render(
      <LessonVocabularySection
        entries={[
          entry('word:coffee', 'required', 'new'),
          entry('word:tea', 'extended', 'recycled'),
        ]}
      />,
    );
    expect(
      byTestId(tree, 'lesson-vocabulary-group-required')[0]!.findAll(
        node => node.props.testID === 'lesson-vocabulary-word:coffee',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      byTestId(tree, 'lesson-vocabulary-group-extended')[0]!.findAll(
        node => node.props.testID === 'lesson-vocabulary-word:tea',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      byTestId(tree, 'lesson-vocabulary-intro-word:tea')[0]!.props.label,
    ).toBe('Ôn lại');
  });

  it('keeps one list for a learner-made lesson', () => {
    const tree = render(
      <LessonVocabularySection entries={[entry('word:coffee', null, null)]} />,
    );
    expect(byTestId(tree, 'lesson-vocabulary-group-required')).toHaveLength(0);
    expect(byTestId(tree, 'lesson-vocabulary-intro-word:coffee')).toHaveLength(
      0,
    );
  });
});
