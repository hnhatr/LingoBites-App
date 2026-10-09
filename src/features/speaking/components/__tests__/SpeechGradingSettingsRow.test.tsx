jest.mock('../../logic/recordingService', () => ({
  deleteRecordingFile: jest.fn(() => Promise.resolve()),
  readRecordingFileForUpload: jest.fn(),
}));
jest.mock('../../logic/upload/recordingUploadQueue', () => ({
  requestRecordingUploadDrain: jest.fn(),
}));

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {createTaskAnswer, getTaskAnswer} from '@core/sync/taskAnswers';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {isEvaluationConsentOn} from '../../logic/upload/recordingConsent';
import {requestRecordingUploadDrain} from '../../logic/upload/recordingUploadQueue';
import {applyEvaluationConsent} from '../SpeechGradingSettingsRow';

/** PR 14 (decision H6): the grading consent switch in Settings. */
const ATTEMPT = '66666666-6666-4666-8666-666666666666';
const RECORDING = '77777777-7777-4777-8777-777777777777';

beforeEach(() => {
  jest.clearAllMocks();
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

function queueAnswer(uploadState: string) {
  getDatabase().execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
      owner_user_id, upload_state, upload_attempts
    ) VALUES (?, ?, NULL, 'lesson_task', '/rec/a.m4a', 4000, 'x', 'u', ?, 0);`,
    [RECORDING, ATTEMPT, uploadState],
  );
  createTaskAnswer({
    attemptId: ATTEMPT,
    ownerUserId: 'u',
    target: {
      lesson_id: '11111111-1111-4111-8111-111111111111',
      block_id: '22222222-2222-4222-8222-222222222222',
    },
    taskId: '55555555-5555-4555-8555-555555555555',
    source: 'speech',
    substitute: false,
    supportLevel: 'none',
    recordingId: RECORDING,
    state: 'waiting_upload',
  });
}

it('turning it on starts the queue', () => {
  applyEvaluationConsent('on');
  expect(isEvaluationConsentOn()).toBe(true);
  expect(requestRecordingUploadDrain).toHaveBeenCalled();
});

it('turning it off drops answers not yet uploaded', () => {
  queueAnswer('pending');
  applyEvaluationConsent('off');
  expect(isEvaluationConsentOn()).toBe(false);
  const left = getDatabase()
    .execute('SELECT COUNT(*) AS n FROM speaking_recordings;')
    .rows?.item(0);
  expect(left).toEqual({n: 0});
  expect(getTaskAnswer(ATTEMPT)).toBeNull();
});

it('an answer already uploaded stays and waits for its result', () => {
  queueAnswer('uploaded');
  applyEvaluationConsent('off');
  expect(getTaskAnswer(ATTEMPT)).not.toBeNull();
});
