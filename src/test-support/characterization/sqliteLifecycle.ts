import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';

/**
 * Drops in-memory DB handles and reopens the same on-disk (mock-keyed) database,
 * matching a process kill + cold start without clearing persisted rows.
 */
export function simulateDatabaseProcessRestart(): void {
  resetDatabaseForTests(null);
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
}
