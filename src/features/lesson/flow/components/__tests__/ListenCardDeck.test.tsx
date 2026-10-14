import React from 'react';

import {speak} from '@features/audio';

import {itemCardIds} from '@core/schemas/lesson';

import {
  has,
  press,
  renderWithTheme,
  seedSnapshot,
  textOf,
} from '@test/support/lessonFlow';

import {flowItems} from '../../logic/flowContent';
import {ListenCardDeck, SLOW_TTS_RATE} from '../ListenCardDeck';

jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));

const snapshot = seedSnapshot();
const items = flowItems(snapshot);
const block = snapshot.blocks.find(
  candidate => candidate.type === 'item_cards' && candidate.step === 2,
)!;
const ids = itemCardIds(block).filter(id => items.has(id));

beforeEach(() => {
  jest.mocked(speak).mockClear();
});

describe('ListenCardDeck (step 2)', () => {
  it('shows one card at a time and pages through the deck', () => {
    const tree = renderWithTheme(
      <ListenCardDeck block={block} items={items} />,
    );
    expect(ids.length).toBeGreaterThan(1);
    expect(has(tree, `lesson-flow-card-${ids[0]}`)).toBe(true);
    expect(has(tree, `lesson-flow-card-${ids[1]}`)).toBe(false);
    expect(textOf(tree, 'lesson-flow-card-count')).toBe(`1 / ${ids.length}`);

    press(tree, 'lesson-flow-card-next');
    expect(has(tree, `lesson-flow-card-${ids[1]}`)).toBe(true);
    press(tree, 'lesson-flow-card-previous');
    expect(has(tree, `lesson-flow-card-${ids[0]}`)).toBe(true);
  });

  it('reveals the meaning when the card is tapped', () => {
    const tree = renderWithTheme(
      <ListenCardDeck block={block} items={items} />,
    );
    expect(has(tree, 'lesson-flow-card-meaning')).toBe(false);
    press(tree, 'lesson-flow-card-reveal');
    expect(textOf(tree, 'lesson-flow-card-meaning')).toBe(
      items.get(ids[0]!)!.meaning_vi,
    );
  });

  it('speaks a word at normal and slow speed', () => {
    const tree = renderWithTheme(
      <ListenCardDeck block={block} items={items} />,
    );
    const position = ids.findIndex(id => items.get(id)!.kind !== 'pattern');
    for (let i = 0; i < position; i += 1) press(tree, 'lesson-flow-card-next');
    const text = items.get(ids[position]!)!.text;
    press(tree, 'lesson-flow-card-listen');
    press(tree, 'lesson-flow-card-listen-slow');
    expect(speak).toHaveBeenNthCalledWith(1, text);
    expect(speak).toHaveBeenNthCalledWith(2, text, undefined, SLOW_TTS_RATE);
  });
});
