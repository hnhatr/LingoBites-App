import AsyncStorage from '@react-native-async-storage/async-storage';
import {open} from 'react-native-quick-sqlite';

import {YOUTUBE_DISCLOSURE_KEY} from '@features/lesson/player/logic/youtubeDisclosure';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
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
});
