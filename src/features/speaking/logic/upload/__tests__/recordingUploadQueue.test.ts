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

function seedPendingRow() {
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

function uploadState(): string {
  const row = getDatabase()
    .execute('SELECT upload_state FROM speaking_recordings WHERE id = ?;', [
      TAKE_ID,
    ])
    .rows?.item(0) as {upload_state?: string} | undefined;
  return row?.upload_state ?? '';
}

describe('recordingUploadQueue', () => {
  beforeEach(() => {
    resetRecordingUploadQueueForTests();
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetRecordingUploadQueueForTests();
    resetDatabaseForTests(null);
  });

  it('sends zero requests when consent is off and flips pending to local_only', async () => {
    seedPendingRow();
    getDatabase().execute('UPDATE app_settings SET value = ? WHERE key = ?;', [
      'off',
      RECORDING_UPLOAD_CONSENT_KEY,
    ]);
    const createMetadata = jest.fn();
    const uploadBinary = jest.fn();
    configureRecordingUploadQueue({
      createMetadata,
      uploadBinary,
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
    });
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();
    expect(createMetadata).not.toHaveBeenCalled();
    expect(uploadBinary).not.toHaveBeenCalled();
    expect(uploadState()).toBe('local_only');
  });

  it('sends zero requests when the account owner does not match', async () => {
    seedPendingRow();
    const createMetadata = jest.fn();
    configureRecordingUploadQueue({
      createMetadata,
      isOwner: jest.fn().mockResolvedValue(false),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
    });
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();
    expect(createMetadata).not.toHaveBeenCalled();
    expect(uploadState()).toBe('pending');
  });

  it('re-checks consent on the send path after enqueue', async () => {
    seedPendingRow();
    let consentOn = true;
    const createMetadata = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        recording: {recording_id: 'srv-1'},
        upload: {
          url: '/v1/recordings/srv-1/content',
          content_type: 'audio/mp4',
        },
      },
      status: 201,
    });
    const uploadBinary = jest.fn().mockResolvedValue({ok: true, status: 200});
    configureRecordingUploadQueue({
      createMetadata,
      uploadBinary,
      isConsentOn: () => consentOn,
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
    });
    consentOn = false;
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();
    expect(createMetadata).not.toHaveBeenCalled();
    expect(uploadState()).toBe('local_only');
  });

  it('marks permanent failures as failed without deleting the row', async () => {
    seedPendingRow();
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
      createMetadata: jest.fn().mockResolvedValue({
        ok: false,
        errorCode: 'VALIDATION_RECORDING',
        message: 'bad',
        retryable: false,
      }),
    });
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();
    expect(uploadState()).toBe('failed');
    const count = getDatabase()
      .execute('SELECT COUNT(*) AS c FROM speaking_recordings WHERE id = ?;', [
        TAKE_ID,
      ])
      .rows?.item(0) as {c?: number};
    expect(Number(count?.c ?? 0)).toBe(1);
  });

  it('keeps pending after many transient failures', async () => {
    seedPendingRow();
    configureRecordingUploadQueue({
      randomFn: () => 0,
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
      createMetadata: jest.fn().mockResolvedValue({
        ok: false,
        errorCode: 'HTTP_503',
        message: 'down',
        retryable: true,
      }),
    });
    for (let i = 0; i < 50; i += 1) {
      requestRecordingUploadDrain();
      await flushRecordingUploadQueueForTests();
      getDatabase().execute(
        'UPDATE speaking_recordings SET upload_next_at = ? WHERE id = ?;',
        [T0, TAKE_ID],
      );
    }
    expect(uploadState()).toBe('pending');
  });

  it('uploads successfully with owner guard on the client calls', async () => {
    seedPendingRow();
    const createMetadata = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        recording: {recording_id: 'srv-1'},
        upload: {
          url: '/v1/recordings/srv-1/content',
          content_type: 'audio/mp4',
        },
      },
      status: 201,
    });
    const uploadBinary = jest.fn().mockResolvedValue({ok: true, status: 200});
    configureRecordingUploadQueue({
      createMetadata,
      uploadBinary,
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
    });
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();
    expect(createMetadata).toHaveBeenCalledWith(
      expect.objectContaining({mime_type: 'audio/mp4'}),
      {expectedUserId: USER_ID},
    );
    expect(uploadBinary).toHaveBeenCalledWith(
      '/v1/recordings/srv-1/content',
      'audio/mp4',
      expect.anything(),
      {expectedUserId: USER_ID},
    );
    expect(uploadState()).toBe('uploaded');
  });

  it('survives queue re-init and resumes pending work', async () => {
    seedPendingRow();
    const mocks = {
      createMetadata: jest.fn().mockResolvedValue({
        ok: true,
        data: {
          recording: {recording_id: 'srv-1'},
          upload: {
            url: '/v1/recordings/srv-1/content',
            content_type: 'audio/mp4',
          },
        },
        status: 201,
      }),
      uploadBinary: jest.fn().mockResolvedValue({ok: true, status: 200}),
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: true,
        byteSize: 10,
        sha256: 'a'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
    };
    configureRecordingUploadQueue(mocks);
    resetRecordingUploadQueueForTests();
    configureRecordingUploadQueue(mocks);
    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();
    expect(uploadState()).toBe('uploaded');
  });
});
