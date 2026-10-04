jest.mock('../../recordingService', () => ({
  readRecordingFileForUpload: jest.fn(),
}));

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(() => ({apiBaseUrl: 'https://api.lingobites.test'})),
}));

jest.mock('@core/auth/authClient', () => ({
  createAuthClient: jest.fn(() => ({})),
}));

jest.mock('@core/auth/authSession', () => ({
  ensureValidSession: jest.fn(),
}));

jest.mock('@core/sync/syncDrainOwnership', () => ({
  assertSyncDrainOwnershipUnchanged: jest.fn().mockResolvedValue(true),
  isAccountStillOwner: jest.fn(),
  SyncOwnershipChangedError: class SyncOwnershipChangedError extends Error {},
}));

import {ensureValidSession} from '@core/auth/authSession';
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
const FILE_PATH = '/tmp/rec.m4a';

const mockedEnsureValidSession = ensureValidSession as jest.Mock;
let previousFetch: typeof global.fetch;

function seedPendingRow(): void {
  const db = getDatabase();
  db.execute(
    `INSERT INTO speaking_recordings (
      id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
      sentence_id, owner_user_id, upload_state, upload_attempts,
      upload_next_at, upload_error, server_recording_id
    ) VALUES (?, NULL, ?, 'shadowing', ?, 1200, ?, ?, ?, 'pending', 0, NULL, NULL, NULL);`,
    [TAKE_ID, LESSON_ID, FILE_PATH, T0, SENTENCE_ID, USER_ID],
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

function validSession() {
  return {
    status: 'valid' as const,
    userId: USER_ID,
    session: {access_token: 'token'},
  };
}

function metadataBody() {
  return {
    request_id: 'req-1',
    status: 'success',
    recording: {
      recording_id: '55555555-5555-4555-8555-555555555555',
      status: 'pending_upload',
      mime_type: 'audio/mp4',
      byte_size: 10,
      sha256: 'a'.repeat(64),
      upload_expires_at: '2026-10-04T10:15:00.000Z',
      created_at: T0,
      completed_at: null,
      client_recording_id: TAKE_ID,
      lesson_id: LESSON_ID,
      sentence_id: SENTENCE_ID,
      mode: 'shadowing',
      duration_ms: 1200,
    },
    upload: {
      method: 'PUT',
      url: '/v1/recordings/55555555-5555-4555-8555-555555555555/content',
      content_type: 'audio/mp4',
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    clone: () => jsonResponse(status, body),
  };
  return response as unknown as Response;
}

function configureSuccessfulFileRead(): void {
  configureRecordingUploadQueue({
    isOwner: jest.fn().mockResolvedValue(true),
    readFile: jest.fn().mockResolvedValue({
      ok: true,
      byteSize: 10,
      sha256: 'a'.repeat(64),
      binary: new ArrayBuffer(8),
    }),
  });
}

function methodCount(fetchMock: jest.Mock, method: string): number {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === method)
    .length;
}

describe('recording upload send-boundary adversarial attacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRecordingUploadQueueForTests();
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
    seedPendingRow();
    jest.useFakeTimers();
    previousFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = previousFetch;
    jest.useRealTimers();
    resetRecordingUploadQueueForTests();
    resetDatabaseForTests(null);
  });

  it('ADV-003 / INV-002: revoking consent during auth sends zero metadata requests', async () => {
    mockedEnsureValidSession.mockImplementation(async () => {
      revokeConsent();
      return validSession();
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(201, metadataBody()));
    global.fetch = fetchMock as unknown as typeof fetch;
    configureSuccessfulFileRead();

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(methodCount(fetchMock, 'POST')).toBeLessThanOrEqual(0);
  });

  it('ADV-004 / INV-002: revoking consent during upload auth sends zero binary requests', async () => {
    let sessionChecks = 0;
    mockedEnsureValidSession.mockImplementation(async () => {
      sessionChecks += 1;
      if (sessionChecks === 2) revokeConsent();
      return validSession();
    });
    const fetchMock = jest
      .fn()
      .mockImplementation(async (_input, init) =>
        init?.method === 'POST'
          ? jsonResponse(201, metadataBody())
          : jsonResponse(200, {}),
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    configureSuccessfulFileRead();

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(methodCount(fetchMock, 'PUT')).toBeLessThanOrEqual(0);
  });

  it('ADV-005 / INV-002: revoking consent during a 401 refresh sends no retry', async () => {
    let sessionChecks = 0;
    mockedEnsureValidSession.mockImplementation(async () => {
      sessionChecks += 1;
      if (sessionChecks === 2) revokeConsent();
      return validSession();
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {error: {code: 'UNAUTHORIZED'}}))
      .mockResolvedValueOnce(jsonResponse(201, metadataBody()));
    global.fetch = fetchMock as unknown as typeof fetch;
    configureSuccessfulFileRead();

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    expect(methodCount(fetchMock, 'POST')).toBeLessThanOrEqual(1);
  });

  it('H2 / INV-001: NOT_FOUND keeps the persisted row and file reference', async () => {
    configureRecordingUploadQueue({
      isOwner: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue({
        ok: false,
        errorCode: 'NOT_FOUND',
      }),
    });

    requestRecordingUploadDrain();
    await flushRecordingUploadQueueForTests();

    const row = getDatabase()
      .execute(
        'SELECT id, file_path, upload_state FROM speaking_recordings WHERE id = ?;',
        [TAKE_ID],
      )
      .rows?.item(0) as
      | {id: string; file_path: string; upload_state: string}
      | undefined;
    expect(row).toEqual({
      id: TAKE_ID,
      file_path: FILE_PATH,
      upload_state: 'failed',
    });
  });

  it.each(['UNAVAILABLE', 'READ_FAILED'])(
    'H3 / INV-001: transient file error %s stays pending for retry',
    async errorCode => {
      configureRecordingUploadQueue({
        randomFn: () => 0,
        isOwner: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue({ok: false, errorCode}),
      });

      requestRecordingUploadDrain();
      await flushRecordingUploadQueueForTests();

      const row = getDatabase()
        .execute(
          `SELECT upload_state, upload_attempts, upload_next_at, upload_error
           FROM speaking_recordings WHERE id = ?;`,
          [TAKE_ID],
        )
        .rows?.item(0) as
        | {
            upload_state: string;
            upload_attempts: number;
            upload_next_at: string | null;
            upload_error: string | null;
          }
        | undefined;
      expect(row).toEqual(
        expect.objectContaining({
          upload_state: 'pending',
          upload_attempts: 1,
          upload_error: errorCode,
        }),
      );
      expect(row?.upload_next_at).not.toBeNull();
    },
  );
});
