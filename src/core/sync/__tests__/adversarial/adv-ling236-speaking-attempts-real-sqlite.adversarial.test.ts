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
  applySpeakingAttemptRecord,
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

function saveAttempt(practicedAt: string) {
  return saveShadowingAttempt({
    takeId: TAKE_ID,
    lessonId: LESSON_ID,
    sentenceId: SENTENCE_ID,
    filePath: audioPath,
    durationMs: 1200,
    checkFullSentence: true,
    checkKeyWords: true,
    checkRhythm: true,
    sentence: {textEn: 'Hello', textVi: 'Xin chao'},
    practicedAt,
  });
}

function tombstone(occurredAt: string) {
  return {
    collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
    entity_id: speakingAttemptEntityId('shadowing', SENTENCE_ID),
    payload: {},
    revision: 9,
    occurred_at: occurredAt,
    updated_at: occurredAt,
    tombstone: true,
  } as const;
}

beforeEach(() => {
  stopPullWorker();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling236-adversarial-'));
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

describe('LING-236 adversarial speaking_attempts pull coverage', () => {
  it('ADV-001 / INV-005: a stale tombstone cannot delete a newer local save', () => {
    expect(saveAttempt(LATE).ok).toBe(true);

    const pendingUnlinks: string[] = [];
    applySpeakingAttemptRecord(tombstone(EARLY), pendingUnlinks);

    expect(
      getSpeakingAttemptForSentence('shadowing', SENTENCE_ID),
    ).toMatchObject({recordingId: TAKE_ID, practicedAt: LATE});
    expect(findSpeakingRecordingById(TAKE_ID)).not.toBeNull();
    expect(pendingUnlinks).toEqual([]);
  });

  it('ADV-002 / INV-005 / AC-026 S3: pull unlinks the tombstoned recording file after commit', async () => {
    expect(saveAttempt(EARLY).ok).toBe(true);
    db.execute('UPDATE sync_outbox SET synced_at = ? WHERE id = ?;', [
      EARLY,
      TAKE_ID,
    ]);

    jest.mocked(RNFS.unlink).mockImplementation(async filePath => {
      const observer = openRealSqlite(dbPath);
      try {
        const attempt = observer
          .execute(
            'SELECT id FROM speaking_attempts WHERE sentence_id = ? LIMIT 1;',
            [SENTENCE_ID],
          )
          .rows?.item(0);
        const cursor = observer
          .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
            'sync_cursor',
          ])
          .rows?.item(0) as {value?: string} | undefined;
        expect(attempt).toBeUndefined();
        expect(cursor?.value).toBe('cursor-after-tombstone');
      } finally {
        observer.close();
      }
      fs.unlinkSync(filePath);
    });

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: '55555555-5555-4555-8555-555555555555',
        status: 'success',
        contract_version: 2,
        has_more: false,
        next_cursor: 'cursor-after-tombstone',
        records: [tombstone(LATE)],
      }),
    }) as unknown as typeof fetch;

    startPullWorker();
    await new Promise(resolve => setTimeout(resolve, 50));
    stopPullWorker();

    expect(getSpeakingAttemptForSentence('shadowing', SENTENCE_ID)).toBeNull();
    expect(findSpeakingRecordingById(TAKE_ID)).toBeNull();
    expect(fs.existsSync(audioPath)).toBe(false);
  });
});
