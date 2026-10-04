import AsyncStorage from '@react-native-async-storage/async-storage';
import {open} from 'react-native-quick-sqlite';

import {YOUTUBE_DISCLOSURE_KEY} from '@features/lesson/player/logic/youtubeDisclosure';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {clearAllLocalDatabaseRows} from '@core/db/localDataWipe';

import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';

describe('localDataWipe youtube disclosure (LING-191 AC-008)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('keeps youtube_disclosure_ack_v1 after clearAllLocalDatabaseRows', async () => {
    await AsyncStorage.setItem(YOUTUBE_DISCLOSURE_KEY, '1');
    await clearAllLocalDatabaseRows();
    expect(await AsyncStorage.getItem(YOUTUBE_DISCLOSURE_KEY)).toBe('1');
  });

  it('keeps current_account_id after clearAllLocalDatabaseRows (AD-007)', async () => {
    const accountId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const db = getDatabase();
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', accountId, '2026-10-04T10:00:00.000Z'],
    );
    await clearAllLocalDatabaseRows();
    const row = db
      .execute('SELECT value FROM app_settings WHERE key = ?;', [
        'current_account_id',
      ])
      .rows?.item(0) as {value?: string};
    expect(row?.value).toBe(accountId);
  });
});
