import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {countSpeakingAttempts} from '@features/speaking/logic/data/SpeakingAttemptRepository';
import {
  countSpeakingRecordingsForSentence,
  insertSpeakingRecordingV4,
} from '@features/speaking/logic/data/SpeakingRepository';
import {saveShadowingAttempt} from '@features/speaking/logic/shadowing/saveShadowingAttempt';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import {
  applySpeakingAttemptRecord,
  buildSpeakingAttemptPayload,
  getLocalSpeakingAttemptWriteTime,
  SPEAKING_ATTEMPTS_EVENT_TYPE,
  speakingAttemptEntityId,
} from '@core/sync/speakingAttempts';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222222';
const TAKE_A = '33333333-3333-4333-8333-333333333331';
const TAKE_B = '33333333-3333-4333-8333-333333333332';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const EARLY = '2026-10-01T10:00:00.000Z';
const LATE = '2026-10-07T12:00:00.000Z';

let dbPath: string;
let db: RealSqliteConnection;

function entityId() {
  return speakingAttemptEntityId('shadowing', SENTENCE_ID);
}

function payloadFor(
  takeId: string,
  checks = {full: true, keys: true, rhythm: true},
) {
  return buildSpeakingAttemptPayload({
    lessonId: LESSON_ID,
    sentenceId: SENTENCE_ID,
    mode: 'shadowing',
    checkFullSentence: checks.full,
    checkKeyWords: checks.keys,
    checkRhythm: checks.rhythm,
    durationMs: 1200,
    recordingId: takeId,
  });
}

beforeEach(() => {
  dbPath = path.join(
    os.tmpdir(),
    `ling236-speaking-pull-${Date.now()}-${Math.random()}.sqlite`,
  );
  db = openRealSqlite(dbPath);
  resetDatabaseForTests(db);
  runMigrations(db);
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_ID, EARLY],
  );
});

afterEach(() => {
  db.close();
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore
  }
  resetDatabaseForTests(null);
});

describe('speaking_attempts pull apply (INV-005)', () => {
  it('applies a newer remote attempt over an older local row', () => {
    saveShadowingAttempt({
      takeId: TAKE_A,
      lessonId: LESSON_ID,
      sentenceId: SENTENCE_ID,
      filePath: '/local/a.m4a',
      durationMs: 1000,
      checkFullSentence: true,
      checkKeyWords: true,
      checkRhythm: true,
      sentence: {textEn: 'A', textVi: 'A'},
      practicedAt: EARLY,
    });

    applySpeakingAttemptRecord({
      collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
      entity_id: entityId(),
      payload: payloadFor(TAKE_B, {full: false, keys: true, rhythm: false}),
      revision: 12,
      occurred_at: LATE,
      updated_at: LATE,
      tombstone: false,
    });

    const row = db
      .execute(
        `SELECT check_full_sentence, recording_id FROM speaking_attempts
         WHERE sentence_id = ? LIMIT 1;`,
        [SENTENCE_ID],
      )
      .rows?.item(0) as {
      check_full_sentence: number;
      recording_id: string;
    };
    expect(row.check_full_sentence).toBe(0);
    expect(row.recording_id).toBe(TAKE_B);
  });

  it('skips an older remote attempt when local pending outbox is newer', () => {
    enqueueSyncOutboxEvent({
      id: TAKE_B,
      eventType: SPEAKING_ATTEMPTS_EVENT_TYPE,
      entityId: entityId(),
      payload: payloadFor(TAKE_B),
      createdAt: LATE,
    });
    expect(getLocalSpeakingAttemptWriteTime(entityId())).toBe(LATE);

    applySpeakingAttemptRecord({
      collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
      entity_id: entityId(),
      payload: payloadFor(TAKE_A),
      revision: 3,
      occurred_at: EARLY,
      updated_at: EARLY,
      tombstone: false,
    });

    expect(countSpeakingAttempts()).toBe(0);
  });

  it('tombstone removes attempt and local recording metadata', () => {
    insertSpeakingRecordingV4({
      id: TAKE_A,
      lessonId: LESSON_ID,
      sentenceId: SENTENCE_ID,
      mode: 'shadowing',
      filePath: '/local/a.m4a',
      durationMs: 900,
      ownerUserId: USER_ID,
      uploadState: 'local_only',
    });
    db.execute(
      `INSERT INTO speaking_attempts (
        id, lesson_id, sentence_id, mode, practiced_at,
        check_full_sentence, check_key_words, check_rhythm,
        duration_ms, recording_id, revision, updated_at
      ) VALUES (?, ?, ?, 'shadowing', ?, 1, 1, 1, 900, ?, 1, ?);`,
      [TAKE_A, LESSON_ID, SENTENCE_ID, EARLY, TAKE_A, EARLY],
    );

    const pendingUnlinks: string[] = [];
    applySpeakingAttemptRecord(
      {
        collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
        entity_id: entityId(),
        payload: {},
        revision: 99,
        occurred_at: LATE,
        updated_at: LATE,
        tombstone: true,
      },
      pendingUnlinks,
    );

    expect(countSpeakingAttempts()).toBe(0);
    expect(countSpeakingRecordingsForSentence('shadowing', SENTENCE_ID)).toBe(
      0,
    );
    expect(pendingUnlinks).toEqual(['/local/a.m4a']);
  });

  it('push-then-pull converges to the newer remote write', () => {
    saveShadowingAttempt({
      takeId: TAKE_B,
      lessonId: LESSON_ID,
      sentenceId: SENTENCE_ID,
      filePath: '/local/b.m4a',
      durationMs: 1100,
      checkFullSentence: false,
      checkKeyWords: false,
      checkRhythm: false,
      sentence: {textEn: 'B', textVi: 'B'},
      practicedAt: EARLY,
    });
    db.execute('UPDATE sync_outbox SET synced_at = ? WHERE id = ?;', [
      EARLY,
      TAKE_B,
    ]);

    applySpeakingAttemptRecord({
      collection: SPEAKING_ATTEMPTS_EVENT_TYPE,
      entity_id: entityId(),
      payload: payloadFor(TAKE_A),
      revision: 5,
      occurred_at: LATE,
      updated_at: LATE,
      tombstone: false,
    });

    const row = db
      .execute(
        'SELECT recording_id FROM speaking_attempts WHERE sentence_id = ?;',
        [SENTENCE_ID],
      )
      .rows?.item(0) as {recording_id: string};
    expect(row.recording_id).toBe(TAKE_A);
  });
});
