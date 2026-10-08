import {
  APP_SCHEMA_VERSION,
  BASELINE_TABLES,
  readAppSchemaVersion,
  runMigrations,
} from '@core/db/migrations';

import {PRIOR_SCHEMA_403BC52} from '@test/support/adversarial/priorSchema403bc52';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/** Baseline schema v7 on real SQLite (PR 5, decisions G2 and G3). */

let db: RealSqliteConnection;

function names(type: 'table' | 'index'): string[] {
  const result = db.execute(
    `SELECT name FROM sqlite_master
      WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name;`,
    [type],
  ).rows;
  const out: string[] = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) {
    out.push((result!.item(i) as {name: string}).name);
  }
  return out;
}

function insertCard(id: string, itemKey: string, tombstone = 0) {
  db.execute(
    `INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi,
       is_saved, created_at, updated_at, tombstone, item_key)
     VALUES (?, 'L1', ?, 'coffee', 'cà phê', 1, 'x', 'x', ?, ?);`,
    [id, id, tombstone, itemKey],
  );
}

beforeEach(() => {
  db = openRealSqlite();
});

afterEach(() => {
  db.close();
});

describe('baseline schema', () => {
  it('creates exactly the baseline tables on a new database', () => {
    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
    expect(names('table')).toEqual([...BASELINE_TABLES].sort());
    expect(names('index')).toContain('idx_flashcards_item_key_live');
  });

  it('resets an install from the old chain and drops its tables (G2)', () => {
    for (const sql of PRIOR_SCHEMA_403BC52) {
      try {
        db.execute(sql);
      } catch (error) {
        if (!String((error as Error).message).includes('duplicate column')) {
          throw error;
        }
      }
    }
    db.execute(
      `INSERT INTO gamification_events (id, event_type, source_event_id, points, created_at)
       VALUES ('gam-prior', 'review_session_completed', 's', 24, 'x');`,
    );
    db.execute('PRAGMA user_version = 6;');

    runMigrations(db);

    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
    expect(names('table')).toEqual([...BASELINE_TABLES].sort());
    expect(() => db.execute('SELECT 1 FROM lessons LIMIT 1;')).toThrow();
    expect(
      db
        .execute('SELECT COUNT(*) AS n FROM gamification_events;')
        .rows?.item(0),
    ).toEqual({n: 0});
  });

  it('leaves a current database and its rows untouched', () => {
    runMigrations(db);
    insertCard('c1', 'word:coffee');
    runMigrations(db);
    runMigrations(db);
    expect(
      db.execute('SELECT COUNT(*) AS n FROM flashcards;').rows?.item(0),
    ).toEqual({n: 1});
  });

  it('allows one live card per item code, any number of tombstoned ones', () => {
    runMigrations(db);
    insertCard('c1', 'word:coffee');
    expect(() => insertCard('c2', 'word:coffee')).toThrow(/UNIQUE/);
    insertCard('c3', 'word:coffee', 1);
    insertCard('c4', 'word:coffee', 1);
    expect(() =>
      db.execute(
        `INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi,
           is_saved, created_at, updated_at)
         VALUES ('c5', 'L1', 'c5', 'tea', 'trà', 1, 'x', 'x');`,
      ),
    ).toThrow(/NOT NULL/);
  });
});
