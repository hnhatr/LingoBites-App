import {
  APP_SCHEMA_VERSION,
  readAppSchemaVersion,
  runMigrations,
} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

/** Vocab path P5: the v10 → v11 upgrade adds the word pack tables and keeps what is on the device. */

const TABLES = ['catalog_items', 'word_pack_downloads', 'combo_sets_local'];

it('upgrades a v10 database to v11 and keeps its flashcards', () => {
  const db = openRealSqlite();
  runMigrations(db);
  for (const table of TABLES) {
    db.execute(`DROP TABLE ${table};`);
  }
  db.execute(
    `INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi,
       is_saved, created_at, updated_at, tombstone, item_key)
     VALUES ('c1', 'L1', 'c1', 'coffee', 'cà phê', 1, 'x', 'x', 0, 'word:coffee');`,
  );
  db.execute('PRAGMA user_version = 10;');

  runMigrations(db);

  expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION);
  for (const table of TABLES) {
    expect(
      db.execute(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;`,
        [table],
      ).rows?.length,
    ).toBe(1);
  }
  expect(
    db.execute('SELECT COUNT(*) AS n FROM flashcards;').rows?.item(0),
  ).toEqual({n: 1});
  db.close();
});
