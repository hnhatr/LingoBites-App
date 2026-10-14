import {
  ANDROID_FILES_PATH,
  IOS_DOCUMENT_PATH,
  open,
  type Scalar,
} from '@op-engineering/op-sqlite';
import {Platform} from 'react-native';

/**
 * The connection shape the app was written against (the former
 * `react-native-quick-sqlite` API): a synchronous `execute` whose rows expose
 * `length`, `item(i)` and `_array`. Repositories, migrations and the
 * transaction helpers only use this, so the SQLite library underneath can
 * change without touching them.
 */
export type QueryResult = {
  insertId?: number;
  rowsAffected: number;
  rows?: {
    _array: any[];
    length: number;

    item: (index: number) => any;
  };
};

export type DatabaseConnection = {
  execute: (query: string, params?: any[]) => QueryResult;
};

/**
 * Where `react-native-quick-sqlite` kept its files: the app's Documents
 * directory on iOS and `getFilesDir()` on Android. Opening the same name
 * there keeps the learner's existing database (unsynced progress and the
 * sync outbox) across the library change.
 */
function databaseLocation(): string {
  return Platform.OS === 'ios' ? IOS_DOCUMENT_PATH : ANDROID_FILES_PATH;
}

function toRows<T>(array: T[]): NonNullable<QueryResult['rows']> {
  return {_array: array, length: array.length, item: index => array[index]};
}

export function openDatabase({name}: {name: string}): DatabaseConnection {
  const db = open({name, location: databaseLocation()});
  return {
    execute(query, params) {
      // Like quick-sqlite, op-sqlite binds `undefined` as NULL.
      const result = db.executeSync(query, params as Scalar[] | undefined);
      return {
        insertId: result.insertId,
        rowsAffected: result.rowsAffected,
        rows: toRows(result.rows),
      };
    },
  };
}
