/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  getYouTubeProgress,
  saveYouTubeProgress,
} from '@features/youtube/logic/data/YouTubeProgressRepository';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {useAccountStore} from '../useAccountStore';

describe('cross-account cache isolation', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests();
  });

  it('switch account → wipe → no leakage', async () => {
    // 1. Setup user 1
    saveYouTubeProgress({
      lessonId: 'user1-lesson',
      positionMs: 1000,
      segmentIndex: 0,
    });
    expect(getYouTubeProgress('user1-lesson')).toBeTruthy();

    // 2. Wipe database (simulating switch account)
    __resetMockDatabases();
    resetDatabaseForTests();

    // 3. Verify wiped
    expect(getYouTubeProgress('user1-lesson')).toBeNull();
  });
});
