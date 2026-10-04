import * as RNFS from '@dr.pogodin/react-native-fs';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  __esModule: true,
  DocumentDirectoryPath: '/mock/Documents',
  readDir: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('@features/speaking/logic/upload/recordingUploadQueue', () => ({
  requestRecordingUploadDrain: jest.fn(),
  initRecordingUploadQueue: jest.fn(),
}));

import {countSpeakingAttempts} from '@features/speaking/logic/data/SpeakingAttemptRepository';
import {insertSpeakingRecordingV4} from '@features/speaking/logic/data/SpeakingRepository';
import {queueAccountOnlyServerRecordingDelete} from '@features/speaking/logic/upload/serverRecordingDeletion';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  applySpeakingAttemptRecord,
  buildSpeakingAttemptPayload,
  SPEAKING_ATTEMPTS_EVENT_TYPE,
  speakingAttemptEntityId,
} from '@core/sync/speakingAttempts';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '../../LocalDataDeletionService';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222222';
const TAKE_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_A = '44444444-4444-4444-8444-444444444441';
const OWNER_B = '44444444-4444-4444-8444-444444444442';
const OLD_REMOTE_WRITE = '2026-10-04T09:00:00.000Z';
const DELETE_TIME = '2026-10-04T10:00:00.000Z';

let db: RealSqliteConnection;

function seedCurrentAccount(ownerUserId = OWNER_A): void {
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', ownerUserId, OLD_REMOTE_WRITE],
  );
}

function insertAttempt(): void {
  db.execute(
    `INSERT INTO speaking_attempts (
      id, lesson_id, sentence_id, mode, practiced_at,
      check_full_sentence, check_key_words, check_rhythm,
      duration_ms, recording_id, revision, updated_at
    ) VALUES (?, ?, ?, 'shadowing', ?, 1, 1, 1, 1200, ?, 1, ?);`,
    [
      TAKE_ID,
      LESSON_ID,
      SENTENCE_ID,
      OLD_REMOTE_WRITE,
      TAKE_ID,
      OLD_REMOTE_WRITE,
    ],
  );
}

function markDeleteTombstoneSynced(): void {
  db.execute(
    `UPDATE sync_outbox
     SET synced_at = ?
     WHERE event_type = ? AND payload_json = '{"tombstone":true}';`,
    [DELETE_TIME, SPEAKING_ATTEMPTS_EVENT_TYPE],
  );
}

function applyOlderRemoteAttempt(): void {
  applySpeakingAttemptRecord({
    collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
    entity_id: speakingAttemptEntityId('shadowing', SENTENCE_ID),
    payload: buildSpeakingAttemptPayload({
      lessonId: LESSON_ID,
      sentenceId: SENTENCE_ID,
      mode: 'shadowing',
      checkFullSentence: true,
      checkKeyWords: true,
      checkRhythm: true,
      durationMs: 1200,
      recordingId: TAKE_ID,
    }),
    revision: 1,
    occurred_at: OLD_REMOTE_WRITE,
    updated_at: OLD_REMOTE_WRITE,
    tombstone: false,
  });
}

beforeEach(() => {
  db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
  jest.mocked(RNFS.readDir).mockReset().mockResolvedValue([]);
  jest.mocked(RNFS.unlink).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  db.close();
  resetDatabaseForTests(null);
  jest.useRealTimers();
});

describe('LING-241 delete finality (INV-004 / INV-T2)', () => {
  it('ADV-001 / INV-004 / AC-3: full wipe rejects an older pull after its tombstone is synced', async () => {
    jest.useFakeTimers().setSystemTime(new Date(DELETE_TIME));
    seedCurrentAccount();
    insertAttempt();

    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async () => true,
    });
    expect(result.dbCleared).toBe(true);
    expect(countSpeakingAttempts()).toBe(0);

    markDeleteTombstoneSynced();
    applyOlderRemoteAttempt();

    expect(countSpeakingAttempts()).toBe(0);
  });

  it('ADV-002 / INV-004 / AC-3: speaking-only wipe rejects an older pull after its tombstone is synced', async () => {
    jest.useFakeTimers().setSystemTime(new Date(DELETE_TIME));
    seedCurrentAccount();
    insertAttempt();

    const result = await clearSpeakingLocalData({
      fileDeleter: async () => true,
    });
    expect(result.dbCleared).toBe(true);
    expect(countSpeakingAttempts()).toBe(0);

    markDeleteTombstoneSynced();
    applyOlderRemoteAttempt();

    expect(countSpeakingAttempts()).toBe(0);
  });

  it('ADV-003 / H4: account-only delete does not suppress another owner recording', () => {
    seedCurrentAccount(OWNER_A);
    insertSpeakingRecordingV4({
      id: TAKE_ID,
      lessonId: LESSON_ID,
      sentenceId: SENTENCE_ID,
      mode: 'shadowing',
      filePath: '/mock/Documents/LingoBitesRecordings/b.m4a',
      durationMs: 1200,
      createdAt: OLD_REMOTE_WRITE,
      ownerUserId: OWNER_B,
      uploadState: 'pending',
    });

    queueAccountOnlyServerRecordingDelete(OWNER_A);

    const row = db
      .execute(
        'SELECT upload_state FROM speaking_recordings WHERE id = ? LIMIT 1;',
        [TAKE_ID],
      )
      .rows?.item(0) as {upload_state?: string};
    expect(row.upload_state).toBe('pending');
  });

  it('ADV-004 / INV-004 / AC-5: full wipe does not acknowledge an unreadable recordings directory as swept', async () => {
    jest.useFakeTimers().setSystemTime(new Date(DELETE_TIME));
    seedCurrentAccount();
    jest
      .mocked(RNFS.readDir)
      .mockRejectedValue(new Error('EACCES: recordings directory unreadable'));

    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async () => true,
    });

    expect(result.ok).toBe(false);
  });
});
