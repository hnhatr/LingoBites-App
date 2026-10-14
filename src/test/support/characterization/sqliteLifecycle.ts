import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {openDatabase as open} from '@core/db/sqlite';

/**
 * Drops in-memory DB handles and reopens the same on-disk (mock-keyed) database,
 * matching a process kill + cold start without clearing persisted rows.
 */
export function simulateDatabaseProcessRestart(
  databaseName: string = DB_NAME,
): void {
  resetDatabaseForTests(null);
  resetDatabaseForTests(open({name: databaseName}));
  getDatabase();
}
