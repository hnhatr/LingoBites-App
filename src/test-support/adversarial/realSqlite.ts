import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

/**
 * LING-93 adversarial review: a `react-native-quick-sqlite`-shaped connection
 * backed by a real SQLite engine (Node `node:sqlite`). Production repositories,
 * migrations and `withTransaction` run unchanged against it, so BEGIN/COMMIT/
 * ROLLBACK, PRIMARY KEY/UNIQUE constraints and ALTER TABLE have real SQLite
 * semantics instead of the string-matching Jest mock.
 */
const {DatabaseSync} = require('node:sqlite');

type Param = string | number | null | boolean | undefined | bigint;

function normalizeParam(value: Param): string | number | null | bigint {
  if (value === undefined) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value;
}

export type RealSqliteConnection = QuickSQLiteConnection & {
  raw: {exec: (sql: string) => void};
  path: string;
};

export function openRealSqlite(path = ':memory:'): RealSqliteConnection {
  const db = new DatabaseSync(path);
  // node:sqlite errors come from the host realm; re-create them in the Jest
  // realm so production `error instanceof Error` checks behave as on device.
  const execute = (sql: string, params: Param[] = []) => {
    try {
      return executeRaw(sql, params);
    } catch (error) {
      throw new Error((error as {message?: string}).message ?? String(error));
    }
  };
  const executeRaw = (sql: string, params: Param[]) => {
    const trimmed = sql.trim();
    if (params.length === 0 && /^(BEGIN|COMMIT|ROLLBACK)\b/i.test(trimmed)) {
      db.exec(trimmed);
      return {rowsAffected: 0, rows: toRows([])};
    }
    const statement = db.prepare(trimmed);
    const values = params.map(normalizeParam);
    const cleanSql = trimmed
      .replace(/^(\s*--[^\n]*\n)+/g, '')
      .replace(/^(\s*\/\*[\s\S]*?\*\/\s*)+/g, '')
      .trim();
    const hasColumns =
      typeof statement.columns === 'function'
        ? statement.columns().length > 0
        : /^(SELECT|WITH|EXPLAIN|VALUES)\b/i.test(cleanSql) ||
          (/^PRAGMA\b/i.test(cleanSql) &&
            !/^PRAGMA\s+[\w_]+\s*=/i.test(cleanSql));
    if (hasColumns) {
      const all = statement.all(...values) as Array<Record<string, unknown>>;
      return {rowsAffected: 0, rows: toRows(all)};
    }
    const result = statement.run(...values);
    return {
      rowsAffected: Number(result.changes),
      insertId: Number(result.lastInsertRowid),
      rows: toRows([]),
    };
  };
  const connection = {
    execute,
    close: () => db.close(),
    raw: {exec: (sql: string) => db.exec(sql)},
    path,
  };
  return connection as unknown as RealSqliteConnection;
}

function toRows(items: Array<Record<string, unknown>>) {
  const array = items.map(item => ({...item}));
  return {
    _array: array,
    length: array.length,
    item: (index: number) => array[index],
  };
}
