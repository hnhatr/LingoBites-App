import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as RNFS from '@dr.pogodin/react-native-fs';

import {getSpeakingAttemptForSentence} from '@features/speaking/logic/data/SpeakingAttemptRepository';
import {findSpeakingRecordingById} from '@features/speaking/logic/data/SpeakingRepository';
import {saveShadowingAttempt} from '@features/speaking/logic/shadowing/saveShadowingAttempt';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  SPEAKING_ATTEMPTS_EVENT_TYPE,
  speakingAttemptEntityId,
} from '@core/sync/speakingAttempts';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  startPullWorker,
  stopPullWorker,
} from '../../../../features/sync/logic/pullWorker';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_SENTENCE_ID = '77777777-7777-4777-8777-777777777777';
const OLD_TAKE_ID = '33333333-3333-4333-8333-333333333333';
const NEW_TAKE_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_TAKE_ID = '88888888-8888-4888-8888-888888888888';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const EARLY = '2026-10-01T10:00:00.000Z';
const TOMBSTONED = '2026-10-07T12:00:00.000Z';
const RE_RECORDED = '2026-10-08T12:00:00.000Z';
const PENDING_UNLINKS_KEY = 'speaking.pending_recording_unlinks';

let tempDir: string;
let audioPath: string;
let db: RealSqliteConnection;
let previousFetch: typeof global.fetch;

function saveAttempt(takeId: string, sentenceId: string, practicedAt: string) {
  return saveShadowingAttempt({
    takeId,
    lessonId: LESSON_ID,
    sentenceId,
    filePath: audioPath,
    durationMs: 1200,
    checkFullSentence: true,
    checkKeyWords: true,
    checkRhythm: true,
    sentence: {textEn: 'Hello', textVi: 'Xin chao'},
    practicedAt,
  });
}

function tombstone() {
  return {
    collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
    entity_id: speakingAttemptEntityId('shadowing', SENTENCE_ID),
    payload: {},
    revision: 9,
    occurred_at: TOMBSTONED,
    updated_at: TOMBSTONED,
    tombstone: true,
  } as const;
}

function pullResponse(records: unknown[], nextCursor: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      request_id: '55555555-5555-4555-8555-555555555555',
      status: 'success',
      contract_version: 2,
      has_more: false,
      next_cursor: nextCursor,
      records,
    }),
  };
}

async function waitForWorker(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 50));
  stopPullWorker();
}

beforeEach(() => {
  stopPullWorker();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling236-r4-'));
  audioPath = path.join(tempDir, 'take.m4a');
  fs.writeFileSync(audioPath, 'old audio');
  db = openRealSqlite(path.join(tempDir, 'lingobites.sqlite'));
  resetDatabaseForTests(db);
  runMigrations(db);
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_ID, EARLY],
  );
  expect(saveAttempt(OLD_TAKE_ID, SENTENCE_ID, EARLY).ok).toBe(true);
  db.execute('UPDATE sync_outbox SET synced_at = ? WHERE id = ?;', [
    EARLY,
    OLD_TAKE_ID,
  ]);
  previousFetch = global.fetch;
  jest.mocked(RNFS.unlink).mockReset();
});

afterEach(() => {
  stopPullWorker();
  global.fetch = previousFetch;
  db.close();
  resetDatabaseForTests(null);
  fs.rmSync(tempDir, {recursive: true, force: true});
});

describe('LING-236 r4 cleanup ownership re-sweep', () => {
  it('ADV-005 / INV-003 / INV-005 / AC-026 S3: re-record during an in-flight unlink cannot lose live audio', async () => {
    let signalUnlinkStarted!: () => void;
    let allowUnlink!: () => void;
    const unlinkStarted = new Promise<void>(resolve => {
      signalUnlinkStarted = resolve;
    });
    const unlinkAllowed = new Promise<void>(resolve => {
      allowUnlink = resolve;
    });
    jest.mocked(RNFS.unlink).mockImplementation(async filePath => {
      signalUnlinkStarted();
      await unlinkAllowed;
      fs.unlinkSync(filePath);
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        pullResponse([tombstone()], 'cursor-after-tombstone'),
      ) as typeof fetch;

    startPullWorker();
    await unlinkStarted;

    fs.writeFileSync(audioPath, 'new audio');
    expect(saveAttempt(NEW_TAKE_ID, SENTENCE_ID, RE_RECORDED).ok).toBe(true);
    allowUnlink();
    await waitForWorker();

    expect(
      getSpeakingAttemptForSentence('shadowing', SENTENCE_ID),
    ).toMatchObject({recordingId: NEW_TAKE_ID, practicedAt: RE_RECORDED});
    expect(findSpeakingRecordingById(NEW_TAKE_ID)).toMatchObject({
      filePath: audioPath,
    });
    expect(fs.existsSync(audioPath)).toBe(true);
  });

  it('ADV-006 / INV-003 / INV-005 / AC-026 S3: re-record during an in-flight queued retry cannot lose live audio', async () => {
    jest
      .mocked(RNFS.unlink)
      .mockRejectedValueOnce(new Error('transient unlink failure'));
    global.fetch = jest.fn().mockImplementation(async input => {
      const cursor = new URL(String(input)).searchParams.get('cursor');
      return cursor
        ? pullResponse([], 'cursor-after-restart')
        : pullResponse([tombstone()], 'cursor-after-tombstone');
    }) as unknown as typeof fetch;

    startPullWorker();
    await waitForWorker();
    expect(fs.existsSync(audioPath)).toBe(true);

    let signalUnlinkStarted!: () => void;
    let allowUnlink!: () => void;
    const unlinkStarted = new Promise<void>(resolve => {
      signalUnlinkStarted = resolve;
    });
    const unlinkAllowed = new Promise<void>(resolve => {
      allowUnlink = resolve;
    });
    jest
      .mocked(RNFS.unlink)
      .mockReset()
      .mockImplementation(async filePath => {
        signalUnlinkStarted();
        await unlinkAllowed;
        fs.unlinkSync(filePath);
      });

    startPullWorker();
    await unlinkStarted;

    fs.writeFileSync(audioPath, 'new audio');
    expect(saveAttempt(NEW_TAKE_ID, SENTENCE_ID, RE_RECORDED).ok).toBe(true);
    allowUnlink();
    await waitForWorker();

    expect(
      getSpeakingAttemptForSentence('shadowing', SENTENCE_ID),
    ).toMatchObject({recordingId: NEW_TAKE_ID, practicedAt: RE_RECORDED});
    expect(findSpeakingRecordingById(NEW_TAKE_ID)).toMatchObject({
      filePath: audioPath,
    });
    expect(fs.existsSync(audioPath)).toBe(true);
  });

  it('H2 / H5 / INV-005: immediate cleanup keeps a path shared by another live row', async () => {
    expect(saveAttempt(OTHER_TAKE_ID, OTHER_SENTENCE_ID, RE_RECORDED).ok).toBe(
      true,
    );
    jest.mocked(RNFS.unlink).mockImplementation(async filePath => {
      fs.unlinkSync(filePath);
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        pullResponse([tombstone()], 'cursor-after-tombstone'),
      ) as typeof fetch;

    startPullWorker();
    await waitForWorker();

    expect(
      getSpeakingAttemptForSentence('shadowing', OTHER_SENTENCE_ID),
    ).toMatchObject({recordingId: OTHER_TAKE_ID});
    expect(findSpeakingRecordingById(OTHER_TAKE_ID)).toMatchObject({
      filePath: audioPath,
    });
    expect(fs.existsSync(audioPath)).toBe(true);
  });

  it('H4 / H5 / INV-005: a queued missing file is cleared without blocking pull', async () => {
    const missingPath = path.join(tempDir, 'already-missing.m4a');
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [PENDING_UNLINKS_KEY, JSON.stringify([missingPath]), EARLY],
    );
    jest.mocked(RNFS.unlink).mockResolvedValue();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(pullResponse([], 'cursor-after-missing-file')) as
      | typeof fetch;

    startPullWorker();
    await waitForWorker();

    expect(
      db
        .execute('SELECT value FROM app_settings WHERE key = ?;', [
          PENDING_UNLINKS_KEY,
        ])
        .rows?.item(0),
    ).toBeUndefined();
    expect(
      db
        .execute('SELECT value FROM app_settings WHERE key = ?;', [
          'sync_cursor',
        ])
        .rows?.item(0),
    ).toMatchObject({value: 'cursor-after-missing-file'});
  });
});
