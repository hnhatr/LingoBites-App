import {
  APP_SCHEMA_VERSION,
  readAppSchemaVersion,
  runMigrations,
  runMigrationsThroughSchemaV5,
} from '@core/db/migrations';
import {APP_SCHEMA_VERSION_V5} from '@core/db/schemaV5';
import {
  APP_SCHEMA_VERSION_V6,
  ensureSchemaV6Upgrade,
  SCHEMA_V6_DOWN_STATEMENTS,
  SCHEMA_V6_TABLES,
} from '@core/db/schemaV6';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

/** Schema v6 on real SQLite: the `lesson_bookmarks` table and its rollback. */

let db: RealSqliteConnection;

function tableNames(): string[] {
  const result = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  ).rows;
  const names: string[] = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) {
    names.push((result!.item(i) as {name: string}).name);
  }
  return names;
}

beforeEach(() => {
  db = openRealSqlite();
  runMigrationsThroughSchemaV5(db);
});

describe('schema v6 upgrade', () => {
  it('moves a v5 database to v6 and is the current app schema', () => {
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V5);
    ensureSchemaV6Upgrade(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V6);
    expect(APP_SCHEMA_VERSION).toBe(APP_SCHEMA_VERSION_V6);
  });

  it('reaches v6 through the full runMigrations chain', () => {
    runMigrations(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V6);
    expect(tableNames()).toContain('lesson_bookmarks');
  });

  it('adds only tables the wipe list knows about', () => {
    const before = new Set(tableNames());
    ensureSchemaV6Upgrade(db);
    const added = tableNames().filter(name => !before.has(name));
    expect(added.sort()).toEqual([...SCHEMA_V6_TABLES].sort());
  });

  it('leaves other versions untouched', () => {
    const older = openRealSqlite();
    older.execute('PRAGMA user_version = 4;');
    ensureSchemaV6Upgrade(older);
    expect(readAppSchemaVersion(older)).toBe(4);
  });

  it('rolls back when the upgrade fails midway', () => {
    db.execute('CREATE VIEW lesson_bookmarks AS SELECT 1 AS lesson_id;');
    expect(() => ensureSchemaV6Upgrade(db)).toThrow();
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V5);
  });

  it('the down statements return to v5 and the upgrade can run again', () => {
    ensureSchemaV6Upgrade(db);
    for (const sql of SCHEMA_V6_DOWN_STATEMENTS) {
      db.execute(sql);
    }
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V5);
    expect(tableNames()).not.toContain('lesson_bookmarks');
    ensureSchemaV6Upgrade(db);
    expect(readAppSchemaVersion(db)).toBe(APP_SCHEMA_VERSION_V6);
  });
});
