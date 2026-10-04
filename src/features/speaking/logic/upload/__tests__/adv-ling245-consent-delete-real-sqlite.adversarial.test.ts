jest.mock('../../recordingService', () => ({
  readRecordingFileForUpload: jest.fn(),
}));

import {applyRecordingUploadConsent} from '@features/speaking/components/SpeakingRecordingsSettingsRow';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {RECORDING_UPLOAD_CONSENT_KEY} from '../recordingConsent';
import {
  configureRecordingUploadQueue,
  flushRecordingUploadQueueForTests,
  requestRecordingUploadDrain,
  resetRecordingUploadQueueForTests,
} from '../recordingUploadQueue';
import {
  configureServerRecordingDeletion,
  queueAccountOnlyServerRecordingDelete,
  readPendingServerDeleteMarker,
  resetServerRecordingDeletionForTests,
} from '../serverRecordingDeletion';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_A = '44444444-4444-4444-8444-444444444441';
const OWNER_B = '44444444-4444-4444-8444-444444444442';
const T0 = '2026-10-04T10:00:00.000Z';

function seedAccount(owner = OWNER_A): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', owner, T0],
  );
}

function setConsent(value: 'on' | 'off'): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [RECORDING_UPLOAD_CONSENT_KEY, value, T0],
  );
}

function insertRecording(
  id: string,
  owner: string | null,
  state: 'pending' | 'local_only' = 'pending',
): void {
  getDatabase().execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
      sentence_id, owner_user_id, upload_state, upload_attempts,
      upload_next_at, upload_error, server_recording_id
    ) VALUES (?, NULL, ?, 'shadowing', ?, 1200, ?, ?, ?, ?, 0, NULL, NULL, NULL);`,
    [id, LESSON_ID, `/tmp/${id}.m4a`, T0, SENTENCE_ID, owner, state],
  );
}

function states(): string[] {
  const rows = getDatabase().execute(
    'SELECT upload_state FROM speaking_recordings ORDER BY id;',
  ).rows;
  const result: string[] = [];
  for (let index = 0; index < (rows?.length ?? 0); index += 1) {
    result.push((rows?.item(index) as {upload_state: string}).upload_state);
  }
  return result;
}

describe('LING-245 consent and delete invariants', () => {
  beforeEach(() => {
    resetRecordingUploadQueueForTests();
    resetServerRecordingDeletionForTests();
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
    seedAccount();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetRecordingUploadQueueForTests();
    resetServerRecordingDeletionForTests();
    resetDatabaseForTests(null);
  });

  it('INV-002 / H1 HELD: consent off atomically terminals every pending job before a send', async () => {
    insertRecording('recording-a', OWNER_A);
    insertRecording('recording-b', OWNER_B);
    insertRecording('recording-null', null);
    let sends = 0;
    configureRecordingUploadQueue({
      createMetadata: jest.fn().mockImplementation(async () => {
        sends += 1;
        return {ok: false, errorCode: 'unexpected', retryable: false};
      }),
    });

    applyRecordingUploadConsent('off');
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(sends).toBeLessThanOrEqual(0);
    expect(states()).toEqual(['local_only', 'local_only', 'local_only']);
  });

  it('INV-002 / H1 HELD: owner mismatch and NULL owner remain pending and send nothing', async () => {
    setConsent('on');
    insertRecording('recording-mismatch', OWNER_B);
    insertRecording('recording-null', null);
    let sends = 0;
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(false),
      createMetadata: jest.fn().mockImplementation(async () => {
        sends += 1;
        return {ok: false, errorCode: 'unexpected', retryable: false};
      }),
    });

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(sends).toBeLessThanOrEqual(0);
    expect(states()).toEqual(['pending', 'pending']);
  });

  it('A-021 / H5 HELD: enabling consent never backfills an older local-only recording', async () => {
    insertRecording('recording-old', OWNER_A, 'local_only');
    let sends = 0;
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      createMetadata: jest.fn().mockImplementation(async () => {
        sends += 1;
        return {ok: false, errorCode: 'unexpected', retryable: false};
      }),
    });

    applyRecordingUploadConsent('on');
    await flushRecordingUploadQueueForTests();

    expect(sends).toBeLessThanOrEqual(0);
    expect(states()).toEqual(['local_only']);
  });

  it('INV-004 / H3 HELD: delete marker runs before the queue and prevents resurrection', async () => {
    setConsent('on');
    insertRecording('recording-delete', OWNER_A);
    let deleteCalls = 0;
    let sends = 0;
    configureServerRecordingDeletion({
      isOwner: jest.fn().mockResolvedValue(true),
      deleteAll: jest.fn().mockImplementation(async () => {
        deleteCalls += 1;
        return {ok: true, purgedAt: T0};
      }),
    });
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      createMetadata: jest.fn().mockImplementation(async () => {
        sends += 1;
        return {ok: false, errorCode: 'unexpected', retryable: false};
      }),
    });

    queueAccountOnlyServerRecordingDelete(OWNER_A);
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(deleteCalls).toBe(1);
    expect(sends).toBeLessThanOrEqual(0);
    expect(states()).toEqual(['local_only']);
    expect(readPendingServerDeleteMarker()).toBeNull();
  });
});
