import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {countSpeakingAttempts} from '@features/speaking/logic/data/SpeakingAttemptRepository';
import {
  countSpeakingRecordingsForSentence,
  listErrorEvents,
} from '@features/speaking/logic/data/SpeakingRepository';
import {saveShadowingAttempt} from '@features/speaking/logic/shadowing/saveShadowingAttempt';
import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  buildSpeakingAttemptPayload,
  SPEAKING_ATTEMPT_PAYLOAD_KEYS,
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
const T0 = '2026-10-04T10:00:00.000Z';

let dbPath: string;
let db: RealSqliteConnection;

function seedAccount() {
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_ID, T0],
  );
}

function baseInput(takeId: string, filePath: string) {
  return {
    takeId,
    lessonId: LESSON_ID,
    sentenceId: SENTENCE_ID,
    filePath,
    durationMs: 1500,
    checkFullSentence: true,
    checkKeyWords: false,
    checkRhythm: true,
    sentence: {
      textEn: 'Hello world',
      textVi: 'Xin chào',
      ipa: '/həˈloʊ/',
    },
    practicedAt: T0,
  };
}

function countFlashcardsForShadowingSentence(): number {
  const row = db
    .execute(
      `SELECT COUNT(*) AS c FROM flashcards
       WHERE lesson_id = ? AND vocabulary_id = ?;`,
      [LESSON_ID, `shadowing:${SENTENCE_ID}`],
    )
    .rows?.item(0) as {c?: number} | undefined;
  return Number(row?.c ?? 0);
}

function countSchedulesForShadowingSentence(): number {
  const row = db
    .execute(
      `SELECT COUNT(*) AS c FROM review_schedule rs
       INNER JOIN flashcards f ON f.id = rs.card_id
       WHERE f.lesson_id = ? AND f.vocabulary_id = ?;`,
      [LESSON_ID, `shadowing:${SENTENCE_ID}`],
    )
    .rows?.item(0) as {c?: number} | undefined;
  return Number(row?.c ?? 0);
}

beforeEach(() => {
  dbPath = path.join(
    os.tmpdir(),
    `ling236-save-shadowing-${Date.now()}-${Math.random()}.sqlite`,
  );
  db = openRealSqlite(dbPath);
  resetDatabaseForTests(db);
  runMigrations(db);
  seedAccount();
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

describe('saveShadowingAttempt real SQLite', () => {
  it('INV-003: a second take replaces the prior recording row for the sentence', () => {
    const first = saveShadowingAttempt(baseInput(TAKE_A, '/docs/rec-a.m4a'));
    expect(first.ok).toBe(true);
    const second = saveShadowingAttempt(baseInput(TAKE_B, '/docs/rec-b.m4a'));
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.unlinkedFilePaths).toEqual(['/docs/rec-a.m4a']);
    }
    expect(countSpeakingRecordingsForSentence('shadowing', SENTENCE_ID)).toBe(
      1,
    );
    expect(countSpeakingAttempts()).toBe(1);
  });

  it('INV-003: a failed save leaves the prior recording intact', () => {
    saveShadowingAttempt(baseInput(TAKE_A, '/docs/rec-a.m4a'));
    const outcome = saveShadowingAttempt(baseInput(TAKE_B, '/docs/rec-b.m4a'), {
      afterOutboxInsert: () => {
        throw new Error('injected');
      },
    });
    expect(outcome.ok).toBe(false);
    expect(countSpeakingRecordingsForSentence('shadowing', SENTENCE_ID)).toBe(
      1,
    );
    const kept = db
      .execute('SELECT id FROM speaking_recordings LIMIT 1;')
      .rows?.item(0) as {id: string};
    expect(kept.id).toBe(TAKE_A);
  });

  it('INV-008: concurrent replay of the same takeId yields one row set', async () => {
    const input = baseInput(TAKE_A, '/docs/rec-a.m4a');
    const [a, b] = await Promise.all([
      Promise.resolve(saveShadowingAttempt(input)),
      Promise.resolve(saveShadowingAttempt(input)),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(countSpeakingRecordingsForSentence('shadowing', SENTENCE_ID)).toBe(
      1,
    );
    expect(countSpeakingAttempts()).toBe(1);
    expect(listPendingSyncEvents()).toHaveLength(1);
  });

  it('INV-T2: throw after outbox insert rolls back attempt and outbox', () => {
    const outcome = saveShadowingAttempt(
      {
        ...baseInput(TAKE_A, '/docs/rec-a.m4a'),
        checkFullSentence: true,
        checkKeyWords: true,
        checkRhythm: true,
      },
      {
        afterOutboxInsert: () => {
          throw new Error('after outbox');
        },
      },
    );
    expect(outcome.ok).toBe(false);
    expect(countSpeakingAttempts()).toBe(0);
    expect(countSpeakingRecordingsForSentence('shadowing', SENTENCE_ID)).toBe(
      0,
    );
    expect(listPendingSyncEvents()).toHaveLength(0);
  });

  it('INV-007: three failed saves create one flashcard and one schedule', () => {
    for (let i = 0; i < 3; i += 1) {
      const takeId = `55555555-5555-4555-8555-5555555555${String(i).padStart(
        2,
        '0',
      )}`;
      const saved = saveShadowingAttempt({
        ...baseInput(takeId, `/docs/rec-${i}.m4a`),
        checkFullSentence: false,
        checkKeyWords: false,
        checkRhythm: false,
      });
      expect(saved.ok).toBe(true);
    }
    expect(countFlashcardsForShadowingSentence()).toBe(1);
    expect(countSchedulesForShadowingSentence()).toBe(1);
    expect(countSpeakingAttempts()).toBe(1);
  });

  it('AC-029 / INV-006: no error_events row and outbox payload uses allowlist only', () => {
    const saved = saveShadowingAttempt({
      ...baseInput(TAKE_A, '/docs/rec-a.m4a'),
      checkFullSentence: false,
      checkKeyWords: true,
      checkRhythm: true,
    });
    expect(saved.ok).toBe(true);
    expect(listErrorEvents()).toHaveLength(0);
    const [event] = listPendingSyncEvents();
    expect(Object.keys(event.payload as object).sort()).toEqual(
      [...SPEAKING_ATTEMPT_PAYLOAD_KEYS].sort(),
    );
    expect(
      buildSpeakingAttemptPayload({
        lessonId: LESSON_ID,
        sentenceId: SENTENCE_ID,
        mode: 'shadowing',
        checkFullSentence: false,
        checkKeyWords: true,
        checkRhythm: true,
        durationMs: 1500,
        recordingId: TAKE_A,
      }),
    ).toEqual(event.payload);
  });

  it('AC-028 S3: a fully passing attempt creates no flashcard', () => {
    const saved = saveShadowingAttempt({
      ...baseInput(TAKE_A, '/docs/rec-a.m4a'),
      checkFullSentence: true,
      checkKeyWords: true,
      checkRhythm: true,
    });
    expect(saved.ok).toBe(true);
    expect(countFlashcardsForShadowingSentence()).toBe(0);
  });
});
