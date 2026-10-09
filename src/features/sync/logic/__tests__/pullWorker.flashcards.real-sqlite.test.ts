import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {applySyncRecord} from '../pullWorker';

const T1 = '2026-10-08T10:00:00.000Z';

let db: RealSqliteConnection;

beforeEach(() => {
  db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  db.close();
  resetDatabaseForTests(null);
});

function pullCard(id: string, payload: Record<string, unknown>) {
  applySyncRecord({
    collection: 'flashcards',
    entity_id: id,
    payload: {
      id,
      lesson_id: 'lesson-1',
      vocabulary_id: 'vocab-1',
      meaning_vi: 'thức dậy',
      is_saved: 1,
      created_at: T1,
      updated_at: T1,
      ...payload,
    },
    revision: 1,
    occurred_at: T1,
    updated_at: T1,
    tombstone: false,
  });
}

function cardKeys(): Array<{id: string; item_key: string}> {
  const res = db.execute('SELECT id, item_key FROM flashcards ORDER BY id;');
  return res.rows?._array ?? [];
}

describe('pullWorker flashcards on the baseline schema', () => {
  it('keeps the item code a pulled card carries', () => {
    pullCard('card-1', {word: 'wake up', item_key: 'phrase:wake up'});

    expect(cardKeys()).toEqual([{id: 'card-1', item_key: 'phrase:wake up'}]);
  });

  it('derives the item code from the word when the record has none', () => {
    pullCard('card-2', {word: 'Coffee'});

    expect(cardKeys()).toEqual([{id: 'card-2', item_key: 'word:coffee'}]);
  });

  it('skips a card with no usable word instead of throwing', () => {
    expect(() => pullCard('card-3', {word: '   '})).not.toThrow();

    expect(cardKeys()).toEqual([]);
  });
});
