import {saveCatalogItems} from '@core/db/catalogItems';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {CatalogItem} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {itemContents} from '../itemReview';

/** Vocab path P5: an item of a downloaded word pack is found when no lesson on the device carries it. */

const NOW = '2026-10-12T08:00:00.000Z';

const grammar: CatalogItem = {
  id: '00000000-0000-4000-8000-000000000301',
  code: 'grammar:present-perfect',
  kind: 'grammar',
  text: 'Present perfect',
  meaning_vi: 'Hiện tại hoàn thành',
  ipa: null,
  part_of_speech: null,
  note_vi: null,
  audience: 'all',
  payload: {family: 'tense', time: 'present', aspect: 'perfect'},
  audio: null,
  image: null,
  examples: [],
  variants: [],
  errors: [],
};

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('finds a pack item that no lesson carries', () => {
  saveCatalogItems([grammar], 'word_pack', NOW);
  const found = itemContents(['grammar:present-perfect', 'word:nothing-here']);
  expect(found.get('grammar:present-perfect')?.text).toBe('Present perfect');
  expect(found.has('word:nothing-here')).toBe(false);
});

it('leaves the lesson path alone when there are no lessons and no packs', () => {
  expect(itemContents(['word:coffee']).size).toBe(0);
  expect(
    getDatabase()
      .execute('SELECT COUNT(*) AS n FROM catalog_items;')
      .rows?.item(0),
  ).toEqual({n: 0});
});
