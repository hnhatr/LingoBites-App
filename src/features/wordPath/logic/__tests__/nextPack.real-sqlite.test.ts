import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {CatalogItem} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {nextDownloadedPack} from '../nextPack';
import {saveWordPack} from '../wordPackRepository';
import type {WordPackDetail} from '../wordPathClient';

/** Vocab path P5: the next pack is the first downloaded one with words still to learn. */

const NOW = new Date('2026-10-12T08:00:00.000Z');

function word(code: string): CatalogItem {
  return {
    id: `00000000-0000-4000-8000-${code.replace(/\D/g, '').padStart(12, '0')}`,
    code,
    kind: 'word',
    text: code.slice(5),
    meaning_vi: 'nghĩa',
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
  };
}

function pack(id: string, position: number, codes: string[]): WordPackDetail {
  return {
    request_id: 'r',
    status: 'success',
    pack: {
      id,
      cefr_level: 'A1',
      topic_code: null,
      position,
      title_vi: `Gói ${position}`,
    },
    items: codes.map(word),
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

it('is null when no pack is on the device', () => {
  expect(nextDownloadedPack()).toBeNull();
});

it('picks the first pack with words still to learn, and skips a learned one', () => {
  saveWordPack(pack('p1', 1, ['word:aa', 'word:bb']), NOW);
  saveWordPack(pack('p2', 2, ['word:cc', 'word:dd']), NOW);
  getDatabase().execute(
    `INSERT INTO item_memory (item_code, stage, due_at, updated_at)
     VALUES ('word:aa', 0, ?, ?), ('word:bb', 0, ?, ?);`,
    [
      NOW.toISOString(),
      NOW.toISOString(),
      NOW.toISOString(),
      NOW.toISOString(),
    ],
  );
  expect(nextDownloadedPack()).toEqual({
    packId: 'p2',
    titleVi: 'Gói 2',
    learned: 0,
    total: 2,
  });
});
