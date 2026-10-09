jest.mock('../../recordingService', () => ({
  readRecordingFileForUpload: jest.fn(),
}));

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {getTaskAnswer} from '@core/sync/taskAnswers';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {queueLessonTaskRecording} from '../lessonTaskRecording';
import {
  EVALUATION_CONSENT_KEY,
  RECORDING_UPLOAD_CONSENT_KEY,
} from '../recordingConsent';
import {
  configureRecordingUploadQueue,
  flushRecordingUploadQueueForTests,
  resetRecordingUploadQueueForTests,
} from '../recordingUploadQueue';

/**
 * PR 14: a spoken step-5 answer goes through the upload queue as a
 * `lesson_task` recording, under the grading consent only, and its file is
 * deleted once the Server has it.
 */
const LESSON = '11111111-1111-4111-8111-111111111111';
const BLOCK = '22222222-2222-4222-8222-222222222222';
const TASK = '55555555-5555-4555-8555-555555555555';
const ATTEMPT = '66666666-6666-4666-8666-666666666666';
const RECORDING = '77777777-7777-4777-8777-777777777777';
const USER = '44444444-4444-4444-8444-444444444444';
const T0 = '2026-10-09T10:00:00.000Z';

function setting(key: string, value: string) {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, value, T0],
  );
}

function recordingRow() {
  return getDatabase()
    .execute('SELECT * FROM speaking_recordings WHERE id = ?;', [RECORDING])
    .rows?.item(0) as Record<string, unknown> | undefined;
}

function wire(overrides: Record<string, unknown> = {}) {
  const createMetadata = jest.fn().mockResolvedValue({
    ok: true,
    status: 201,
    data: {
      recording: {recording_id: '88888888-8888-4888-8888-888888888888'},
      upload: {
        method: 'PUT',
        url: '/v1/recordings/x/content',
        content_type: 'audio/mp4',
      },
    },
  });
  const uploadBinary = jest.fn().mockResolvedValue({ok: true});
  const deleteFile = jest.fn().mockResolvedValue(undefined);
  configureRecordingUploadQueue({
    createMetadata,
    uploadBinary,
    deleteFile,
    isOwner: jest.fn().mockResolvedValue(true),
    readFile: jest.fn().mockResolvedValue({
      ok: true,
      byteSize: 1400,
      sha256: 'b'.repeat(64),
      binary: new Uint8Array([1, 2, 3]),
    }),
    ...overrides,
  });
  return {createMetadata, uploadBinary, deleteFile};
}

function queue() {
  queueLessonTaskRecording({
    recordingId: RECORDING,
    attemptId: ATTEMPT,
    ownerUserId: USER,
    target: {lesson_id: LESSON, block_id: BLOCK},
    taskId: TASK,
    supportLevel: 'none',
    filePath: '/docs/recordings/lesson_task/a.m4a',
    durationMs: 9450.4,
    now: T0,
  });
}

beforeEach(() => {
  resetRecordingUploadQueueForTests();
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
  setting('current_account_id', USER);
});

afterEach(() => {
  resetRecordingUploadQueueForTests();
  resetDatabaseForTests(null);
});

it('sends a lesson-task request under the grading consent, then drops the file', async () => {
  setting(EVALUATION_CONSENT_KEY, 'on');
  // The upload consent is off: it does not gate task answers.
  setting(RECORDING_UPLOAD_CONSENT_KEY, 'off');
  const {createMetadata, uploadBinary, deleteFile} = wire();
  queue();
  await flushRecordingUploadQueueForTests();

  expect(createMetadata).toHaveBeenCalledWith(
    {
      client_recording_id: RECORDING,
      mode: 'lesson_task',
      attempt_id: ATTEMPT,
      target: {lesson_id: LESSON, block_id: BLOCK},
      support_level: 'none',
      duration_ms: 9450,
      mime_type: 'audio/mp4',
      byte_size: 1400,
      sha256: 'b'.repeat(64),
    },
    {expectedUserId: USER, consent: 'evaluation'},
  );
  expect(uploadBinary).toHaveBeenCalledTimes(1);
  expect(recordingRow()?.upload_state).toBe('uploaded');
  expect(getTaskAnswer(ATTEMPT)?.state).toBe('sent');
  expect(deleteFile).toHaveBeenCalledWith('/docs/recordings/lesson_task/a.m4a');
});

it('without the grading consent nothing is sent and the answer is dropped', async () => {
  setting(EVALUATION_CONSENT_KEY, 'off');
  setting(RECORDING_UPLOAD_CONSENT_KEY, 'on');
  const {createMetadata, deleteFile} = wire();
  queue();
  await flushRecordingUploadQueueForTests();

  expect(createMetadata).not.toHaveBeenCalled();
  expect(recordingRow()).toBeUndefined();
  expect(getTaskAnswer(ATTEMPT)).toBeNull();
  expect(deleteFile).toHaveBeenCalled();
});

it('a failed send is retried later and keeps the answer waiting', async () => {
  jest.useFakeTimers();
  try {
    setting(EVALUATION_CONSENT_KEY, 'on');
    wire({
      createMetadata: jest.fn().mockResolvedValue({
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: 'offline',
        retryable: true,
      }),
      randomFn: () => 0,
    });
    queue();
    await flushRecordingUploadQueueForTests();
    expect(recordingRow()?.upload_state).toBe('pending');
    expect(recordingRow()?.upload_error).toBe('NETWORK_ERROR');
    expect(getTaskAnswer(ATTEMPT)?.state).toBe('waiting_upload');
  } finally {
    jest.useRealTimers();
  }
});
