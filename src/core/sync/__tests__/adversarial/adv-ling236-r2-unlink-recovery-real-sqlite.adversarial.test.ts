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
const TAKE_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const EARLY = '2026-10-01T10:00:00.000Z';
const LATE = '2026-10-07T12:00:00.000Z';

let tempDir: string;
let dbPath: string;
let audioPath: string;
let db: RealSqliteConnection;
let previousFetch: typeof global.fetch;

function entityId(): string {
  return speakingAttemptEntityId('shadowing', SENTENCE_ID);
}

function tombstone() {
  return {
    collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
    entity_id: entityId(),
    payload: {},
    revision: 9,
    occurred_at: LATE,
    updated_at: LATE,
    tombstone: true,
  } as const;
}

function invalidLiveRecord() {
  return {
    ...tombstone(),
    revision: 10,
    payload: {},
    tombstone: false,
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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling236-r2-'));
  dbPath = path.join(tempDir, 'lingobites.sqlite');
  audioPath = path.join(tempDir, 'take.m4a');
  fs.writeFileSync(audioPath, 'audio');
  db = openRealSqlite(dbPath);
  resetDatabaseForTests(db);
  runMigrations(db);
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_ID, EARLY],
  );
  const saved = saveShadowingAttempt({
    takeId: TAKE_ID,
    lessonId: LESSON_ID,
    sentenceId: SENTENCE_ID,
    filePath: audioPath,
    durationMs: 1200,
    checkFullSentence: true,
    checkKeyWords: true,
    checkRhythm: true,
    sentence: {textEn: 'Hello', textVi: 'Xin chao'},
    practicedAt: EARLY,
  });
  expect(saved.ok).toBe(true);
  db.execute('UPDATE sync_outbox SET synced_at = ? WHERE id = ?;', [
    EARLY,
    TAKE_ID,
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

describe('LING-236 r2 pull failure-path attacks', () => {
  it('H2 / INV-005: a later record failure rolls back metadata and never unlinks the file', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        pullResponse(
          [tombstone(), invalidLiveRecord()],
          'cursor-should-rollback',
        ),
      ) as unknown as typeof fetch;

    startPullWorker();
    await waitForWorker();

    expect(
      getSpeakingAttemptForSentence('shadowing', SENTENCE_ID),
    ).toMatchObject({recordingId: TAKE_ID});
    expect(findSpeakingRecordingById(TAKE_ID)).not.toBeNull();
    expect(fs.existsSync(audioPath)).toBe(true);
    const cursor = db
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        'sync_cursor',
      ])
      .rows?.item(0);
    expect(cursor).toBeUndefined();
  });

  it('ADV-003 / INV-005 / AC-026 S3: a transient unlink failure is recovered after restart', async () => {
    jest
      .mocked(RNFS.unlink)
      .mockRejectedValueOnce(new Error('transient unlink failure'))
      .mockImplementation(async filePath => {
        fs.unlinkSync(filePath);
      });

    global.fetch = jest.fn().mockImplementation(async input => {
      const url = new URL(String(input));
      const cursor = url.searchParams.get('cursor');
      return cursor
        ? pullResponse([], 'cursor-after-restart')
        : pullResponse([tombstone()], 'cursor-after-tombstone');
    }) as unknown as typeof fetch;

    startPullWorker();
    await waitForWorker();
    expect(getSpeakingAttemptForSentence('shadowing', SENTENCE_ID)).toBeNull();
    expect(findSpeakingRecordingById(TAKE_ID)).toBeNull();
    expect(fs.existsSync(audioPath)).toBe(true);

    startPullWorker();
    await waitForWorker();

    expect(fs.existsSync(audioPath)).toBe(false);
  });
});
