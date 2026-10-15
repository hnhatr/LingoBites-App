import React from 'react';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {CatalogItemSchema} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import type {ItemReviewQueue} from '../../logic/itemReview';
import {ItemReviewScreen} from '../ItemReviewScreen';

jest.mock('@features/audio', () =>
  require('@test/support/audioModuleMock').audioModuleMock(
    jest.fn(() => Promise.resolve({ok: true})),
  ),
);
const mockRequestSync = jest.fn();
jest.mock('@features/sync', () => ({requestSync: () => mockRequestSync()}));

/** PR 16 (G9): the item review screen. */
const TEA_ID = '11111111-1111-4111-8111-111111111101';
const MILK_ID = '11111111-1111-4111-8111-111111111102';

function item(id: string, code: string, text: string, meaning: string) {
  return CatalogItemSchema.parse({
    id,
    code,
    kind: 'word',
    text,
    meaning_vi: meaning,
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: {},
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  });
}

const memory = (code: string, stage = 2) => ({
  itemCode: code,
  stage,
  dueAt: '2026-10-01T00:00:00.000Z',
  stableAt: null,
  lastResult: null,
  lastReviewedAt: null,
});

const queue: ItemReviewQueue = {
  items: [
    {memory: memory('word:tea'), item: item(TEA_ID, 'word:tea', 'tea', 'trà')},
    {
      memory: memory('word:milk'),
      item: item(MILK_ID, 'word:milk', 'milk', 'sữa'),
    },
  ],
  missing: 1,
  doneToday: 0,
};

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  mockRequestSync.mockClear();
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('walks through the items and records each answer', () => {
  const goBack = jest.fn();
  const tree = renderWithTheme(
    <ItemReviewScreen navigation={{goBack}} queue={queue} />,
  );
  expect(textOf(tree, 'item-review-missing')).toBe(
    '1 từ cần tải lại bài để ôn',
  );
  expect(textOf(tree, 'item-review-meaning')).toBe('Chạm để xem nghĩa');
  press(tree, 'item-review-reveal');
  expect(textOf(tree, 'item-review-meaning')).toBe('trà');
  press(tree, 'item-review-remembered');
  expect(has(tree, 'item-review-card-word:milk')).toBe(true);
  expect(textOf(tree, 'item-review-meaning')).toBe('Chạm để xem nghĩa');
  press(tree, 'item-review-forgot');

  expect(textOf(tree, 'item-review-summary')).toBe('Nhớ 1 · chưa nhớ 1');
  expect(mockRequestSync).toHaveBeenCalledTimes(2);
  const rows = getDatabase().execute(
    `SELECT item_key, result, session_id FROM activity_attempts
      WHERE kind = 'review' ORDER BY occurred_at, item_key;`,
  ).rows?._array;
  expect(rows?.map(row => [row.item_key, row.result])).toEqual([
    ['word:tea', 'correct'],
    ['word:milk', 'incorrect'],
  ]);
  expect(rows?.[0]?.session_id).toBe(rows?.[1]?.session_id);
  press(tree, 'item-review-back');
  expect(goBack).toHaveBeenCalled();
});

it('says when nothing is due', () => {
  const tree = renderWithTheme(
    <ItemReviewScreen queue={{items: [], missing: 0, doneToday: 3}} />,
  );
  expect(textOf(tree, 'item-review-done')).toContain(
    'Hôm nay không còn từ nào cần ôn.',
  );
});

/** Vocab path P5: a card below stage 2 is asked by recognition; one wrong many times is compared first. */
describe('item review tiers', () => {
  const recognitionQueue: ItemReviewQueue = {
    items: [
      {
        memory: memory('word:tea', 0),
        item: item(TEA_ID, 'word:tea', 'tea', 'trà'),
      },
      {
        memory: memory('word:milk', 0),
        item: item(MILK_ID, 'word:milk', 'milk', 'sữa'),
      },
    ],
    missing: 0,
    doneToday: 0,
  };

  it('asks a new card by choosing its meaning, and records the pick', () => {
    const tree = renderWithTheme(<ItemReviewScreen queue={recognitionQueue} />);
    expect(has(tree, 'item-review-question-word:tea')).toBe(true);
    const shown = [0, 1, 2].filter(i => has(tree, `item-review-option-${i}`));
    const options = shown.map(
      i =>
        tree.root.findAll(
          node =>
            node.props.testID === `item-review-option-${i}` &&
            typeof node.props.title === 'string',
        )[0]!.props.title as string,
    );
    expect(options).toContain('trà');
    const correct = options.indexOf('trà');
    press(tree, `item-review-option-${correct}`);
    expect(has(tree, 'item-review-next')).toBe(true);
    press(tree, 'item-review-next');
    const rows = getDatabase().execute(
      `SELECT item_key, result FROM activity_attempts WHERE kind = 'review';`,
    ).rows?._array;
    expect(rows?.map(row => [row.item_key, row.result])).toEqual([
      ['word:tea', 'correct'],
    ]);
  });

  it('shows the comparison card first when the card has lapsed four times', () => {
    getDatabase().execute(
      `INSERT INTO item_memory (item_code, stage, due_at, updated_at, lapses)
       VALUES ('word:tea', 2, '2026-10-01T00:00:00.000Z', 'x', 4);`,
    );
    const tree = renderWithTheme(
      <ItemReviewScreen
        queue={{
          items: [
            {
              memory: memory('word:tea', 2),
              item: item(TEA_ID, 'word:tea', 'tea', 'trà'),
            },
          ],
          missing: 0,
          doneToday: 0,
        }}
      />,
    );
    expect(has(tree, 'item-review-compare-word:tea')).toBe(true);
    expect(has(tree, 'item-review-card-word:tea')).toBe(false);
    press(tree, 'item-review-compare-ok');
    expect(has(tree, 'item-review-card-word:tea')).toBe(true);
  });
});
