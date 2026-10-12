import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import type {ComboSentence} from '../comboClient';
import {
  listLocalComboSets,
  readLocalComboSet,
  saveComboSet,
} from '../comboSetRepository';

/** Vocab path P5: combo sets are kept on the device, a new batch adds to the same set, and the first save time stays. */

const SET_ID = '0b1f6c1e-2d3a-4b5c-8d9e-333333333333';

function sentence(id: string, text: string): ComboSentence {
  return {
    id,
    position: 0,
    batch: 1,
    subject_group: 'i',
    subject_text: 'I',
    polarity: 'affirmative',
    text_en: text,
    text_vi: 'câu',
    tokens: [{t: 'I', ipa: 'aɪ', role: 'subject'}],
  };
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('keeps a set and reads it back', () => {
  saveComboSet(
    {
      id: SET_ID,
      itemCode: 'word:play',
      grammarCode: 'grammar:present-simple',
      situationCode: 'club',
      sentences: [sentence('s1', 'I play here.')],
    },
    new Date('2026-10-12T08:00:00.000Z'),
  );
  const set = readLocalComboSet(SET_ID);
  expect(set?.sentences.map(item => item.text_en)).toEqual(['I play here.']);
  expect(set?.sentences[0]?.tokens[0]?.role).toBe('subject');
  expect(listLocalComboSets()).toEqual([
    expect.objectContaining({id: SET_ID, sentenceCount: 1}),
  ]);
});

it('adds a batch to the same set and keeps its first save time', () => {
  const base = {
    id: SET_ID,
    itemCode: 'word:play',
    grammarCode: 'grammar:present-simple',
    situationCode: 'club',
  };
  saveComboSet(
    {...base, sentences: [sentence('s1', 'I play here.')]},
    new Date('2026-10-12T08:00:00.000Z'),
  );
  saveComboSet(
    {
      ...base,
      sentences: [
        sentence('s1', 'I play here.'),
        sentence('s2', 'I play today.'),
      ],
    },
    new Date('2026-10-13T08:00:00.000Z'),
  );
  expect(readLocalComboSet(SET_ID)?.sentences).toHaveLength(2);
  expect(readLocalComboSet(SET_ID)?.createdAt).toBe('2026-10-12T08:00:00.000Z');
  expect(
    getDatabase()
      .execute('SELECT COUNT(*) AS n FROM combo_sets_local;')
      .rows?.item(0),
  ).toEqual({n: 1});
});

it('leaves a set with broken sentences empty instead of failing', () => {
  getDatabase().execute(
    `INSERT INTO combo_sets_local (id, item_code, grammar_code, situation_code, sentences_json, created_at)
     VALUES ('bad', 'word:x', 'grammar:y', 'z', 'not json', 'x');`,
  );
  expect(readLocalComboSet('bad')?.sentences).toEqual([]);
});
