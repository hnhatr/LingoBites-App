import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '../constants';
import {getDatabase, resetDatabaseForTests} from '../database';
import {hasInstallMarker, setInstallMarker} from '../installMarker';

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
});

describe('installMarker (SETE-303 / T6)', () => {
  it('reports absent on a fresh install', () => {
    expect(hasInstallMarker()).toBe(false);
  });

  it('persists once the first bootstrap completes', () => {
    expect(setInstallMarker('2026-09-14T00:00:00.000Z')).toBe(true);
    expect(hasInstallMarker()).toBe(true);
  });

  it('stays present across repeated writes (same install)', () => {
    setInstallMarker();
    setInstallMarker();
    expect(hasInstallMarker()).toBe(true);
  });
});
