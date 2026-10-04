jest.mock('../recordingService', () => ({
  readRecordingFileForUpload: jest.fn(),
}));

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {RECORDING_UPLOAD_CONSENT_KEY} from '../upload/recordingConsent';
import {
  configureRecordingUploadQueue,
  flushRecordingUploadQueueForTests,
  requestRecordingUploadDrain,
  resetRecordingUploadQueueForTests,
} from '../upload/recordingUploadQueue';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222222';
const TAKE_ID = '33333333-3333-4333-8333-333333333331';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const T0 = '2026-10-04T10:00:00.000Z';

describe('Recording upload integration', () => {
  beforeEach(() => {
    resetRecordingUploadQueueForTests();
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
    getDatabase().execute(
      `INSERT INTO speaking_recordings (
        id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
        sentence_id, owner_user_id, upload_state, upload_attempts,
        upload_next_at, upload_error, server_recording_id
      ) VALUES (?, NULL, ?, 'shadowing', '/tmp/rec.m4a', 1200, ?, ?, ?, 'pending', 0, NULL, NULL, NULL);`,
      [TAKE_ID, LESSON_ID, T0, SENTENCE_ID, USER_ID],
    );
    getDatabase().execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [RECORDING_UPLOAD_CONSENT_KEY, 'on', T0],
    );
    getDatabase().execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', USER_ID, T0],
    );
  });

  afterEach(() => {
    resetRecordingUploadQueueForTests();
    resetDatabaseForTests(null);
  });

  it('runs metadata create then binary upload for one pending row', async () => {
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
        byteSize: 1024,
        sha256: 'b'.repeat(64),
        binary: new ArrayBuffer(8),
      }),
    });

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(createMetadata).toHaveBeenCalledTimes(1);
    expect(uploadBinary).toHaveBeenCalledTimes(1);
    const row = getDatabase()
      .execute('SELECT upload_state FROM speaking_recordings WHERE id = ?;', [
        TAKE_ID,
      ])
      .rows?.item(0) as {upload_state?: string};
    expect(row?.upload_state).toBe('uploaded');
  });
});
