import React from 'react';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {CatalogItemSchema} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import type {ItemReviewQueue} from '../../logic/itemReview';
import {ItemReviewScreen} from '../ItemReviewScreen';

jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));
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

const memory = (code: string) => ({
  itemCode: code,
  stage: 0,
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
