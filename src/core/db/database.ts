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

/** Matches `INSTALL_MARKER_KEY` in `installMarker.ts` (avoid import cycle). */
const INSTALL_MARKER_KEY = 'account.install_completed_v1';
const CURRENT_ACCOUNT_ID_KEY = 'current_account_id';

function withForeignKeysDisabled<T>(
  db: QuickSQLiteConnection,
  run: () => T,
): T {
  db.execute('PRAGMA foreign_keys = OFF;');
  try {
    return run();
  } finally {
    db.execute('PRAGMA foreign_keys = ON;');
  }
}

function deleteRowsFromAllUserTables(db: QuickSQLiteConnection): void {
  const result = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
  );
  if (!result.rows) {
    return;
  }
  for (let i = 0; i < result.rows.length; i++) {
    const tableName = result.rows.item(i).name;
    db.execute(`DELETE FROM ${tableName};`);
  }
}

export type AccountReplacementOptions = {
  /** ISO timestamp written to `account.install_completed_v1`. */
  installCompletedAt?: string;
};

/**
 * Atomic account replacement (LING-92 TASK-020 / AD-006). Deletes every
 * app-owned SQLite row (including `sync_outbox`) and commits the new
 * `current_account_id` plus install marker in one transaction. Callers must
 * run this only after the account-switch journal is durably confirmed
 * (TASK-021); the pointer does not change until commit succeeds.
 */
export function executeAccountReplacementTransaction(
  db: QuickSQLiteConnection,
  targetAccountId: string,
  options: AccountReplacementOptions = {},
): void {
  const installCompletedAt =
    options.installCompletedAt ?? new Date().toISOString();
  withTransaction(db, () => {
    withForeignKeysDisabled(db, () => {
      deleteRowsFromAllUserTables(db);
    });
    const now = new Date().toISOString();
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [CURRENT_ACCOUNT_ID_KEY, targetAccountId, now],
    );
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [INSTALL_MARKER_KEY, installCompletedAt, now],
    );
  });
}

export function wipeDatabase(db: QuickSQLiteConnection): void {
  withForeignKeysDisabled(db, () => {
    const result = db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
    );
    if (!result.rows || result.rows.length === 0) {
      return;
    }
    db.execute('BEGIN');
    try {
      deleteRowsFromAllUserTables(db);
      db.execute('COMMIT');
    } catch (error) {
      try {
        db.execute('ROLLBACK');
      } catch {
        // Rollback failure leaves the connection unusable; surface the delete error.
      }
      throw error;
    }
  });
}
