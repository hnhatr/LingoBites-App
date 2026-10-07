import {
  APP_SCHEMA_VERSION,
  readAppSchemaVersion,
  runMigrations,
  runMigrationsThroughSchemaV4,
} from '@core/db/migrations';
import {
  APP_SCHEMA_VERSION_V5,
  ensureSchemaV5Upgrade,
  SCHEMA_V5_DOWN_STATEMENTS,
  SCHEMA_V5_TABLES,
} from '@core/db/schemaV5';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/**
 * Schema v5 on real SQLite: one flashcard per lemma, sources, backups, the
 * live-key unique index and atomic rollback.
 * Design: docs/architecture/schema-v5-learning-items-migration.md
 */

const NOW = '2026-10-06T10:00:00.000Z';

let db: RealSqliteConnection;

type CardSeed = {
  id: string;
  lesson: string;
  word: string;
  saved?: number;
  interval?: number;
  createdAt?: string;
  tombstone?: number;
  sentence?: string | null;
};

function seedCard(card: CardSeed): void {
  const createdAt = card.createdAt ?? '2026-09-01T00:00:00.000Z';
  db.execute(
    `INSERT INTO flashcards (
      id, lesson_id, vocabulary_id, word, meaning_vi, source_sentence,
      is_saved, created_at, updated_at, tombstone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      card.id,
      card.lesson,
      `v-${card.id}`,
      card.word,
      `nghĩa ${card.word}`,
      card.sentence ?? null,
      card.saved ?? 1,
      createdAt,
      createdAt,
      card.tombstone ?? 0,
    ],
  );
  db.execute(
    `INSERT INTO review_schedule (
      card_id, lesson_id, interval_days, next_review_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?);`,
    [card.id, card.lesson, card.interval ?? 1, NOW, createdAt, createdAt],
  );
}

function rows(sql: string, params: unknown[] = []): Array<Record<string, any>> {
  const result = db.execute(sql, params as never[]).rows;
  const out: Array<Record<string, any>> = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) {
    out.push(result!.item(i) as Record<string, any>);
  }
  return out;
}

const card = (id: string) =>
  rows('SELECT * FROM flashcards WHERE id = ?;', [id])[0]!;

const sourcesOf = (id: string) =>
  rows(
    'SELECT lesson_id FROM flashcard_sources WHERE card_id = ? ORDER BY lesson_id;',
    [id],
  ).map(row => row.lesson_id);

function tableNames(): string[] {
  return rows(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  ).map(row => row.name);
}

beforeEach(() => {
  db = openRealSqlite();
  runMigrationsThroughSchemaV4(db);
});

describe('schema v5 upgrade', () => {
  it('moves a v4 database to v5, below the current app schema', () => {
    expect(readAppSchemaVersion(db)).toBe(4);
    ensureSchemaV5Upgrade(db, NOW);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V5);
    expect(APP_SCHEMA_VERSION).toBeGreaterThan(APP_SCHEMA_VERSION_V5);
  });

  it('merges cards of one lemma into the best card and keeps every source', () => {
    seedCard({
      id: 'a',
      lesson: 'L1',
      word: 'Coffee',
      interval: 1,
      sentence: 'I like coffee.',
    });
    seedCard({
      id: 'b',
      lesson: 'L2',
      word: 'coffee',
      interval: 7,
      sentence: 'Coffee is hot.',
    });
    seedCard({id: 'c', lesson: 'L3', word: 'coffee.', interval: 3});

    ensureSchemaV5Upgrade(db, NOW);

    expect(card('b').item_key).toBe('word:coffee');
    expect(card('b').tombstone).toBe(0);
    expect(card('b').is_saved).toBe(1);
    for (const loser of ['a', 'c']) {
      expect(card(loser).tombstone).toBe(1);
      expect(card(loser).is_saved).toBe(0);
      expect(card(loser).updated_at).toBe(NOW);
    }
    expect(sourcesOf('b')).toEqual(['L1', 'L2', 'L3']);
    expect(
      rows(
        "SELECT source_sentence FROM flashcard_sources WHERE card_id = 'b' AND lesson_id = 'L1';",
      )[0]!.source_sentence,
    ).toBe('I like coffee.');
    // The winner keeps its own schedule untouched.
    expect(
      rows("SELECT interval_days FROM review_schedule WHERE card_id = 'b';")[0]!
        .interval_days,
    ).toBe(7);
  });

  it('prefers a saved card over an unsaved one and keeps the lemma saved', () => {
    seedCard({id: 'old', lesson: 'L1', word: 'tea', saved: 0, interval: 30});
    seedCard({id: 'new', lesson: 'L2', word: 'Tea', saved: 1, interval: 1});
    ensureSchemaV5Upgrade(db, NOW);
    expect(card('new').tombstone).toBe(0);
    expect(card('new').is_saved).toBe(1);
    expect(card('old').tombstone).toBe(1);
    expect(sourcesOf('new')).toEqual(['L1', 'L2']);
  });

  it('breaks full ties by age and then by id, deterministically', () => {
    seedCard({
      id: 'z',
      lesson: 'L1',
      word: 'milk',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    seedCard({
      id: 'a',
      lesson: 'L2',
      word: 'milk',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    seedCard({
      id: 'm',
      lesson: 'L3',
      word: 'milk',
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    ensureSchemaV5Upgrade(db, NOW);
    expect(card('m').tombstone).toBe(0); // oldest wins
    expect(card('a').tombstone).toBe(1);
    expect(card('z').tombstone).toBe(1);

    db = openRealSqlite();
    runMigrationsThroughSchemaV4(db);
    seedCard({id: 'z', lesson: 'L1', word: 'milk'});
    seedCard({id: 'a', lesson: 'L2', word: 'milk'});
    ensureSchemaV5Upgrade(db, NOW);
    expect(card('a').tombstone).toBe(0); // same age: smallest id wins
  });

  it('keys phrases separately from words', () => {
    seedCard({id: 'p', lesson: 'L1', word: 'Wake  UP'});
    seedCard({id: 'w', lesson: 'L1', word: 'wake'});
    ensureSchemaV5Upgrade(db, NOW);
    expect(card('p').item_key).toBe('phrase:wake up');
    expect(card('w').item_key).toBe('word:wake');
    expect(card('p').tombstone).toBe(0);
    expect(card('w').tombstone).toBe(0);
  });

  it('leaves unusable and already-deleted cards exactly as they were', () => {
    seedCard({id: 'junk', lesson: 'L1', word: '...'});
    seedCard({id: 'gone', lesson: 'L1', word: 'coffee', tombstone: 1});
    seedCard({id: 'live', lesson: 'L2', word: 'coffee'});
    ensureSchemaV5Upgrade(db, NOW);
    expect(card('junk').item_key).toBeNull();
    expect(card('junk').tombstone).toBe(0);
    expect(card('gone').item_key).toBeNull();
    expect(card('gone').tombstone).toBe(1);
    expect(card('live').item_key).toBe('word:coffee');
    expect(sourcesOf('live')).toEqual(['L2']);
  });

  it('backs up the v4 cards and schedules before merging', () => {
    seedCard({id: 'a', lesson: 'L1', word: 'coffee'});
    seedCard({id: 'b', lesson: 'L2', word: 'coffee'});
    ensureSchemaV5Upgrade(db, NOW);
    const backup = rows(
      'SELECT id, tombstone, is_saved FROM flashcards_v4_backup ORDER BY id;',
    );
    expect(backup).toEqual([
      {id: 'a', tombstone: 0, is_saved: 1},
      {id: 'b', tombstone: 0, is_saved: 1},
    ]);
    expect(rows('SELECT * FROM review_schedule_v4_backup;')).toHaveLength(2);
  });

  it('enforces one live card per key but allows a tombstoned twin', () => {
    seedCard({id: 'a', lesson: 'L1', word: 'coffee'});
    ensureSchemaV5Upgrade(db, NOW);
    const insert = (id: string, tombstone: number) =>
      db.execute(
        `INSERT INTO flashcards (
          id, lesson_id, vocabulary_id, word, meaning_vi, is_saved,
          created_at, updated_at, tombstone, item_key
        ) VALUES (?, 'L9', ?, 'coffee', 'cà phê', 1, ?, ?, ?, 'word:coffee');`,
        [id, `v-${id}`, NOW, NOW, tombstone],
      );
    expect(() => insert('dupe', 0)).toThrow(/UNIQUE/i);
    expect(() => insert('twin', 1)).not.toThrow();
  });

  it('is idempotent and skips databases that are not at v4', () => {
    seedCard({id: 'a', lesson: 'L1', word: 'coffee'});
    seedCard({id: 'b', lesson: 'L2', word: 'coffee', interval: 5});
    ensureSchemaV5Upgrade(db, NOW);
    const first = JSON.stringify(rows('SELECT * FROM flashcards ORDER BY id;'));
    const sources = JSON.stringify(
      rows('SELECT * FROM flashcard_sources ORDER BY card_id, lesson_id;'),
    );

    ensureSchemaV5Upgrade(db, '2030-01-01T00:00:00.000Z');
    runMigrations(db);
    expect(JSON.stringify(rows('SELECT * FROM flashcards ORDER BY id;'))).toBe(
      first,
    );
    expect(
      JSON.stringify(
        rows('SELECT * FROM flashcard_sources ORDER BY card_id, lesson_id;'),
      ),
    ).toBe(sources);

    const older = openRealSqlite();
    older.execute('PRAGMA user_version = 3;');
    ensureSchemaV5Upgrade(older, NOW);
    expect(readAppSchemaVersion(older)).toBe(3);
  });

  it('passes v5 on the full runMigrations chain', () => {
    seedCard({id: 'a', lesson: 'L1', word: 'coffee'});
    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
    expect(card('a').item_key).toBe('word:coffee');
  });

  it('rolls everything back when the upgrade fails midway', () => {
    seedCard({id: 'a', lesson: 'L1', word: 'coffee'});
    seedCard({id: 'b', lesson: 'L2', word: 'coffee'});
    // A view with a table's name makes CREATE TABLE fail after the ALTERs ran.
    db.execute('CREATE VIEW activity_attempts AS SELECT 1 AS id;');

    expect(() => ensureSchemaV5Upgrade(db, NOW)).toThrow();

    expect(readAppSchemaVersion(db)).toBe(4);
    const columns = rows('PRAGMA table_info(flashcards);').map(r => r.name);
    expect(columns).not.toContain('item_key');
    expect(tableNames()).not.toContain('flashcard_sources');
    expect(tableNames()).not.toContain('flashcards_v4_backup');
    expect(card('a').tombstone).toBe(0);
    expect(card('b').tombstone).toBe(0);
  });

  it('adds only tables the wipe list knows about', () => {
    const before = new Set(tableNames());
    ensureSchemaV5Upgrade(db, NOW);
    const added = tableNames().filter(name => !before.has(name));
    expect(added.sort()).toEqual([...SCHEMA_V5_TABLES].sort());
  });

  it('the down statements return to v4 and drop the new indexes and tables', () => {
    seedCard({id: 'a', lesson: 'L1', word: 'coffee'});
    ensureSchemaV5Upgrade(db, NOW);
    for (const sql of SCHEMA_V5_DOWN_STATEMENTS) {
      db.execute(sql);
    }
    expect(readAppSchemaVersion(db)).toBe(4);
    expect(tableNames()).not.toContain('activity_attempts');
    expect(tableNames()).not.toContain('flashcard_sources');
    expect(
      rows(
        "SELECT name FROM sqlite_master WHERE name = 'idx_flashcards_item_key_live';",
      ),
    ).toHaveLength(0);
    // The v4 data is intact and the upgrade can run again.
    expect(card('a').is_saved).toBe(1);
    ensureSchemaV5Upgrade(db, NOW);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V5);
  });
});
