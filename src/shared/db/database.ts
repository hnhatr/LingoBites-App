import {open, type QuickSQLiteConnection} from 'react-native-quick-sqlite';
import {DB_NAME} from './constants';
import {runMigrations} from './migrations';

let dbInstance: QuickSQLiteConnection | null = null;
let migrationsApplied = false;

export function getDatabase(): QuickSQLiteConnection {
  if (!dbInstance) {
    dbInstance = open({name: DB_NAME});
  }

  if (!migrationsApplied) {
    runMigrations(dbInstance);
    migrationsApplied = true;
  }

  return dbInstance;
}

export function resetDatabaseForTests(
  connection: QuickSQLiteConnection | null = null,
): void {
  dbInstance = connection;
  migrationsApplied = false;
}

/**
 * Runs `run` between `BEGIN`/`COMMIT`, rolling back when it throws.
 *
 * `react-native-quick-sqlite` exposes a callback-style `transaction()`, but it
 * returns a promise; keeping the raw-BEGIN form lets repository functions stay
 * synchronous (the current codebase contract) while still giving the atomicity
 * the outbox design (ADR-2) relies on for the review write + outbox insert.
 */
export function withTransaction<T>(db: QuickSQLiteConnection, run: () => T): T {
  db.execute('BEGIN');
  try {
    const result = run();
    db.execute('COMMIT');
    return result;
  } catch (error) {
    try {
      db.execute('ROLLBACK');
    } catch {
      // Rollback failure leaves the connection unusable; the original error is
      // what matters and will surface to the caller.
    }
    throw error;
  }
}

export function wipeDatabase(db: QuickSQLiteConnection): void {
  // Disables foreign keys temporarily to truncate all tables
  db.execute('PRAGMA foreign_keys = OFF;');
  const result = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
  );
  if (result.rows) {
    db.execute('BEGIN');
    for (let i = 0; i < result.rows.length; i++) {
      const tableName = result.rows.item(i).name;
      db.execute(`DELETE FROM ${tableName};`);
    }
    db.execute('COMMIT');
  }
  db.execute('PRAGMA foreign_keys = ON;');
}
