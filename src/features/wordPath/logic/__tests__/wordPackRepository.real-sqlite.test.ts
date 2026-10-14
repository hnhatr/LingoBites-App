import {readCatalogItems} from '@core/db/catalogItems';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {CatalogItem} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  findDownloadedPack,
  learnedCodes,
  learnedCount,
  listDownloadedPacks,
  removeDownloadedPacks,
  saveWordPack,
} from '../wordPackRepository';
import type {WordPackDetail} from '../wordPathClient';

/** Vocab path P5: a downloaded word pack is stored whole, read back offline, and counts what the learner already knows. */

const NOW = new Date('2026-10-12T08:00:00.000Z');
const PACK_ID = '0b1f6c1e-2d3a-4b5c-8d9e-111111111111';
const OTHER_PACK_ID = '0b1f6c1e-2d3a-4b5c-8d9e-222222222222';

function item(
  code: string,
  kind: CatalogItem['kind'],
  text: string,
): CatalogItem {
  return {
    id: `00000000-0000-4000-8000-${code.length.toString().padStart(12, '0')}`,
    code,
    kind,
    text,
    meaning_vi: 'nghĩa',
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: kind === 'grammar' ? {family: 'tense', time: 'present'} : {},
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  };
}

function detail(packId: string, items: CatalogItem[]): WordPackDetail {
  return {
    request_id: 'r',
    status: 'success',
    pack: {
      id: packId,
      cefr_level: 'A1',
      topic_code: null,
      position: 1,
      title_vi: 'Gói A1 1',
    },
    items,
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

it('stores a pack and its items, and reads them back without the Server', () => {
  const items = [
    item('word:coffee', 'word', 'coffee'),
    item('grammar:present-simple', 'grammar', 'Present simple'),
  ];
  saveWordPack(detail(PACK_ID, items), NOW);

  const packs = listDownloadedPacks();
  expect(packs).toHaveLength(1);
  expect(packs[0]).toMatchObject({
    packId: PACK_ID,
    cefrLevel: 'A1',
    itemCodes: ['word:coffee', 'grammar:present-simple'],
  });
  expect(findDownloadedPack(PACK_ID)?.titleVi).toBe('Gói A1 1');
  expect(findDownloadedPack(OTHER_PACK_ID)).toBeNull();

  const read = readCatalogItems(['word:coffee', 'grammar:present-simple']);
  expect(read.get('word:coffee')?.text).toBe('coffee');
  expect(read.get('grammar:present-simple')?.kind).toBe('grammar');
});

it('replaces a pack on download again instead of adding a second copy', () => {
  saveWordPack(detail(PACK_ID, [item('word:coffee', 'word', 'coffee')]), NOW);
  saveWordPack(detail(PACK_ID, [item('word:coffee', 'word', 'coffee')]), NOW);
  expect(listDownloadedPacks()).toHaveLength(1);
  expect(
    getDatabase()
      .execute('SELECT COUNT(*) AS n FROM catalog_items;')
      .rows?.item(0),
  ).toEqual({n: 1});
});

it('counts the pack words already in the learner schedule', () => {
  saveWordPack(
    detail(PACK_ID, [
      item('word:coffee', 'word', 'coffee'),
      item('word:tea', 'word', 'tea'),
    ]),
    NOW,
  );
  expect(learnedCount(['word:coffee', 'word:tea'])).toBe(0);
  getDatabase().execute(
    `INSERT INTO item_memory (item_code, stage, due_at, updated_at)
     VALUES ('word:coffee', 0, ?, ?), ('word:elsewhere', 0, ?, ?);`,
    [
      NOW.toISOString(),
      NOW.toISOString(),
      NOW.toISOString(),
      NOW.toISOString(),
    ],
  );
  expect(learnedCount(['word:coffee', 'word:tea'])).toBe(1);
  expect([...learnedCodes(['word:coffee', 'word:tea'])]).toEqual([
    'word:coffee',
  ]);
  expect(learnedCodes([]).size).toBe(0);
});

it('forgets removed packs but keeps their items and what was learned', () => {
  saveWordPack(detail(PACK_ID, [item('word:coffee', 'word', 'coffee')]), NOW);
  saveWordPack(detail(OTHER_PACK_ID, [item('word:tea', 'word', 'tea')]), NOW);
  getDatabase().execute(
    `INSERT INTO item_memory (item_code, stage, due_at, updated_at)
     VALUES ('word:coffee', 0, ?, ?);`,
    [NOW.toISOString(), NOW.toISOString()],
  );

  removeDownloadedPacks([PACK_ID]);
  removeDownloadedPacks([]);

  expect(listDownloadedPacks().map(pack => pack.packId)).toEqual([
    OTHER_PACK_ID,
  ]);
  expect(readCatalogItems(['word:coffee']).get('word:coffee')?.text).toBe(
    'coffee',
  );
  expect(learnedCount(['word:coffee'])).toBe(1);
});
