jest.mock('../../recordingService', () => ({
  readRecordingFileForUpload: jest.fn(),
}));

import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {SPEAKING_ATTEMPTS_EVENT_TYPE} from '@core/sync/speakingAttempts';

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
  PENDING_SERVER_DELETE_KEY,
  queueAccountOnlyServerRecordingDelete,
  queueDurableServerRecordingDelete,
  readPendingServerDeleteMarker,
  resetServerRecordingDeletionForTests,
} from '../serverRecordingDeletion';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_A = '22222222-2222-4222-8222-222222222221';
const SENTENCE_B = '22222222-2222-4222-8222-222222222222';
const TAKE_ID = '33333333-3333-4333-8333-333333333331';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const T0 = '2026-10-04T10:00:00.000Z';

function seedConsentAndAccount(): void {
  const db = getDatabase();
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [RECORDING_UPLOAD_CONSENT_KEY, 'on', T0],
  );
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_ID, T0],
  );
}

function insertPendingRecording(id: string, sentenceId: string): void {
  getDatabase().execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
      sentence_id, owner_user_id, upload_state, upload_attempts,
      upload_next_at, upload_error, server_recording_id
    ) VALUES (?, NULL, ?, 'shadowing', ?, 1200, ?, ?, ?, 'pending', 0, NULL, NULL, NULL);`,
    [id, LESSON_ID, `/tmp/${id}.m4a`, T0, sentenceId, USER_ID],
  );
}

function insertAttempt(sentenceId: string, attemptId: string): void {
  getDatabase().execute(
    `INSERT INTO speaking_attempts (
      id, lesson_id, sentence_id, mode, practiced_at,
      check_full_sentence, check_key_words, check_rhythm,
      duration_ms, recording_id, revision, updated_at
    ) VALUES (?, ?, ?, 'shadowing', ?, 1, 1, 1, 1200, ?, 0, ?);`,
    [attemptId, LESSON_ID, sentenceId, T0, attemptId, T0],
  );
}

describe('serverRecordingDeletion (INV-004 / INV-T2)', () => {
  beforeEach(() => {
    resetRecordingUploadQueueForTests();
    resetServerRecordingDeletionForTests();
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
    seedConsentAndAccount();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetRecordingUploadQueueForTests();
    resetServerRecordingDeletionForTests();
    resetDatabaseForTests(null);
  });

  it('queues tombstones and a durable marker in one transaction', () => {
    insertAttempt(SENTENCE_A, TAKE_ID);
    insertAttempt(SENTENCE_B, 'attempt-b');

    queueDurableServerRecordingDelete({
      ownerUserId: USER_ID,
      enqueueAttemptTombstones: true,
      requestedAt: T0,
    });

    const marker = readPendingServerDeleteMarker();
    expect(marker).toEqual({ownerUserId: USER_ID, requestedAt: T0});

    const pending = listPendingSyncEvents();
    const tombstones = pending.filter(
      e => e.eventType === SPEAKING_ATTEMPTS_EVENT_TYPE,
    );
    expect(tombstones).toHaveLength(2);
    expect(
      tombstones.every(e => (e.payload as {tombstone?: boolean}).tombstone),
    ).toBe(true);
  });

  it('INV-004: processes delete-all before any upload job runs', async () => {
    insertPendingRecording(TAKE_ID, SENTENCE_A);
    queueDurableServerRecordingDelete({
      ownerUserId: USER_ID,
      enqueueAttemptTombstones: false,
      requestedAt: T0,
    });

    let deleteCalls = 0;
    let metadataCalls = 0;
    configureServerRecordingDeletion({
      deleteAll: jest.fn().mockImplementation(async () => {
        deleteCalls += 1;
        return {ok: true, purgedAt: 'ignored'};
      }),
      isOwner: jest.fn().mockResolvedValue(true),
    });
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
      createMetadata: jest.fn().mockImplementation(async () => {
        metadataCalls += 1;
        return {
          ok: false as const,
          errorCode: 'HTTP_503',
          message: 'down',
          retryable: true,
        };
      }),
    });

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(deleteCalls).toBe(1);
    expect(metadataCalls).toBe(0);
    expect(readPendingServerDeleteMarker()).toBeNull();
  });

  it('INV-004: delete queued during an in-flight upload blocks later uploads', async () => {
    insertPendingRecording(TAKE_ID, SENTENCE_A);
    let releaseUpload: (() => void) | undefined;
    const uploadGate = new Promise<void>(resolve => {
      releaseUpload = resolve;
    });

    let metadataCalls = 0;
    let deleteCalls = 0;
    configureServerRecordingDeletion({
      deleteAll: jest.fn().mockImplementation(async () => {
        deleteCalls += 1;
        return {ok: true, purgedAt: 'x'};
      }),
      isOwner: jest.fn().mockResolvedValue(true),
    });
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
      createMetadata: jest.fn().mockImplementation(async () => {
        metadataCalls += 1;
        queueDurableServerRecordingDelete({
          ownerUserId: USER_ID,
          enqueueAttemptTombstones: false,
          requestedAt: T0,
        });
        await uploadGate;
        return {
          ok: false as const,
          errorCode: 'HTTP_503',
          message: 'down',
          retryable: true,
        };
      }),
    });

    requestRecordingUploadDrain();
    await Promise.resolve();
    releaseUpload?.();
    await flushRecordingUploadQueueForTests();
    await flushRecordingUploadQueueForTests();

    expect(metadataCalls).toBe(1);
    expect(deleteCalls).toBe(1);
    expect(
      getDatabase()
        .execute('SELECT upload_state FROM speaking_recordings WHERE id = ?;', [
          TAKE_ID,
        ])
        .rows?.item(0) as {upload_state?: string},
    ).toEqual({upload_state: 'local_only'});
  });

  it('INV-T2 / NFR-001: marker survives simulated restart', () => {
    queueDurableServerRecordingDelete({
      ownerUserId: USER_ID,
      enqueueAttemptTombstones: true,
      requestedAt: T0,
    });

    const db = getDatabase();
    const raw = db
      .execute('SELECT value FROM app_settings WHERE key = ?;', [
        PENDING_SERVER_DELETE_KEY,
      ])
      .rows?.item(0) as {value?: string};

    resetRecordingUploadQueueForTests();
    resetServerRecordingDeletionForTests();
    resetDatabaseForTests(null);

    const restarted = openRealSqlite(':memory:');
    runMigrations(restarted);
    resetDatabaseForTests(restarted);
    restarted.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [PENDING_SERVER_DELETE_KEY, raw.value, T0],
    );

    expect(readPendingServerDeleteMarker()).toEqual({
      ownerUserId: USER_ID,
      requestedAt: T0,
    });
  });

  it('BR-010: account-only delete flips pending rows to local_only without tombstones', () => {
    insertPendingRecording(TAKE_ID, SENTENCE_A);
    insertAttempt(SENTENCE_A, TAKE_ID);

    queueAccountOnlyServerRecordingDelete(USER_ID);

    expect(listPendingSyncEvents()).toHaveLength(0);
    const row = getDatabase()
      .execute('SELECT upload_state FROM speaking_recordings WHERE id = ?;', [
        TAKE_ID,
      ])
      .rows?.item(0) as {upload_state?: string};
    expect(row.upload_state).toBe('local_only');
    expect(readPendingServerDeleteMarker()).not.toBeNull();
  });
});
