jest.mock('../../recordingService', () => ({
  readRecordingFileForUpload: jest.fn(),
}));

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

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222222';
const TAKE_ID = '33333333-3333-4333-8333-333333333331';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const T0 = '2026-10-04T10:00:00.000Z';

function seedPendingRow(): void {
  const db = getDatabase();
  db.execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
      sentence_id, owner_user_id, upload_state, upload_attempts,
      upload_next_at, upload_error, server_recording_id
    ) VALUES (?, NULL, ?, 'shadowing', '/tmp/rec.m4a', 1200, ?, ?, ?, 'pending', 0, NULL, NULL, NULL);`,
    [TAKE_ID, LESSON_ID, T0, SENTENCE_ID, USER_ID],
  );
  db.execute(
    'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [RECORDING_UPLOAD_CONSENT_KEY, 'on', T0],
  );
  db.execute(
    'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_ID, T0],
  );
}

function revokeConsent(): void {
  getDatabase().execute('UPDATE app_settings SET value = ? WHERE key = ?;', [
    'off',
    RECORDING_UPLOAD_CONSENT_KEY,
  ]);
}

function uploadState(): string {
  const row = getDatabase()
    .execute('SELECT upload_state FROM speaking_recordings WHERE id = ?;', [
      TAKE_ID,
    ])
    .rows?.item(0) as {upload_state?: string} | undefined;
  return row?.upload_state ?? '';
}

function successfulMetadataResult() {
  return {
    ok: true as const,
    data: {
      recording: {recording_id: 'srv-1'},
      upload: {
        url: '/v1/recordings/srv-1/content',
        content_type: 'audio/mp4',
      },
    },
    status: 201,
  };
}

describe('recordingUploadQueue adversarial consent and single-flight attacks', () => {
  beforeEach(() => {
    resetRecordingUploadQueueForTests();
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
    seedPendingRow();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetRecordingUploadQueueForTests();
    resetDatabaseForTests(null);
  });

  it('ADV-001 / INV-002: revoking consent while the file is read sends zero metadata requests', async () => {
    let metadataSendAttempts = 0;
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockImplementation(async () => {
        revokeConsent();
        return {
          ok: true as const,
          byteSize: 10,
          sha256: 'a'.repeat(64),
          binary: new ArrayBuffer(8),
        };
      }),
      createMetadata: jest.fn().mockImplementation(async () => {
        metadataSendAttempts += 1;
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

    expect(metadataSendAttempts).toBeLessThanOrEqual(0);
  });

  it('ADV-002 / INV-002: revoking consent after metadata creation sends zero binary requests', async () => {
    let binarySendAttempts = 0;
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
      createMetadata: jest.fn().mockImplementation(async () => {
        revokeConsent();
        return successfulMetadataResult();
      }),
      uploadBinary: jest.fn().mockImplementation(async () => {
        binarySendAttempts += 1;
        return {ok: true as const, status: 200};
      }),
    });

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(binarySendAttempts).toBeLessThanOrEqual(0);
  });

  it('H3 / INV-001: concurrent drain requests send one persisted job at most once', async () => {
    let metadataSendAttempts = 0;
    let binarySendAttempts = 0;
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
      createMetadata: jest.fn().mockImplementation(async () => {
        metadataSendAttempts += 1;
        return successfulMetadataResult();
      }),
      uploadBinary: jest.fn().mockImplementation(async () => {
        binarySendAttempts += 1;
        return {ok: true as const, status: 200};
      }),
    });

    requestRecordingUploadDrain();
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(metadataSendAttempts).toBeLessThanOrEqual(1);
    expect(binarySendAttempts).toBeLessThanOrEqual(1);
    expect(uploadState()).toBe('uploaded');
  });
});
