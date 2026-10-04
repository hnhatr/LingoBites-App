import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {saveLessonSnapshotBody} from '@features/lesson/player/logic/canonicalDownloadRepository';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {LessonSentence} from '@core/schemas/lesson';
import {applySpeakingAttemptRecord} from '@core/sync/speakingAttempts';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  findMostRecentInProgressShadowingLesson,
  listShadowingLessonProgressSummaries,
  resolveShadowingEntry,
  summarizeShadowingLessonProgress,
} from '../shadowingProgress';

const LESSON_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SENTENCE_A = '11111111-1111-4111-8111-111111111111';
const SENTENCE_B = '22222222-2222-4222-8222-222222222222';
const STALE_SENTENCE = '99999999-9999-4999-8999-999999999999';
const T0 = '2026-10-04T10:00:00.000Z';
const T1 = '2026-10-04T11:00:00.000Z';

const FIXTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'core',
  'schemas',
  '__tests__',
  'fixtures',
  'valid-lesson-snapshot-response.json',
);

let dbPath: string;
let db: RealSqliteConnection;

function sentence(id: string, position: number): LessonSentence {
  return {
    id,
    position,
    text_en: `en-${id}`,
    text_vi: `vi-${id}`,
    ipa: `/ipa-${id}/`,
    start_ms: null,
    end_ms: null,
  };
}

function seedLesson(sentences: LessonSentence[]) {
  const body = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as {
    lesson: {id: string; title: string; sentences: LessonSentence[]};
  };
  body.lesson.id = LESSON_ID;
  body.lesson.title = 'Canonical order lesson';
  body.lesson.sentences = sentences;
  saveLessonSnapshotBody({body});
}

function replaySyncedAttempt(input: {
  sentenceId: string;
  practicedAt: string;
  passed?: boolean;
}) {
  const passed = input.passed ?? true;
  applySpeakingAttemptRecord({
    collection: 'speaking_attempts',
    entity_id: `shadowing:${input.sentenceId}`,
    payload: {
      lesson_id: LESSON_ID,
      sentence_id: input.sentenceId,
      mode: 'shadowing',
      check_full_sentence: passed,
      check_key_words: passed,
      check_rhythm: passed,
      duration_ms: 1000,
      recording_id: null,
    },
    revision: 1,
    occurred_at: input.practicedAt,
    updated_at: input.practicedAt,
    tombstone: false,
  });
}

beforeEach(() => {
  dbPath = path.join(
    os.tmpdir(),
    `ling244-r2-adversarial-${Date.now()}-${Math.random()}.sqlite`,
  );
  db = openRealSqlite(dbPath);
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  db.close();
  resetDatabaseForTests(null);
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore
  }
});

describe('LING-244 r2 adversarial canonical-order coverage', () => {
  it('H6 / INV-BR-008: equal timestamps and positions stay stable across replay order', () => {
    seedLesson([sentence(SENTENCE_A, 0), sentence(SENTENCE_B, 0)]);
    replaySyncedAttempt({sentenceId: SENTENCE_A, practicedAt: T0});
    replaySyncedAttempt({sentenceId: SENTENCE_B, practicedAt: T0});
    const beforeReplay = summarizeShadowingLessonProgress(LESSON_ID);

    replaySyncedAttempt({sentenceId: SENTENCE_B, practicedAt: T0});
    replaySyncedAttempt({sentenceId: SENTENCE_A, practicedAt: T0});
    const afterReplay = summarizeShadowingLessonProgress(LESSON_ID);

    expect(afterReplay).toEqual(beforeReplay);
  });

  it('H7 / INV-BR-008: a newer stale-sentence row cannot change resume or continue', () => {
    seedLesson([sentence(SENTENCE_A, 0), sentence(SENTENCE_B, 1)]);
    replaySyncedAttempt({sentenceId: SENTENCE_A, practicedAt: T0});
    const beforeStaleRow = summarizeShadowingLessonProgress(LESSON_ID);

    replaySyncedAttempt({
      sentenceId: STALE_SENTENCE,
      practicedAt: T1,
      passed: false,
    });

    expect(summarizeShadowingLessonProgress(LESSON_ID)).toEqual(beforeStaleRow);
    expect(findMostRecentInProgressShadowingLesson()).toEqual(beforeStaleRow);
  });

  it('H8 / INV-BR-008: picker, continue, Today entry and session start share one result', () => {
    const sentenceC = '33333333-3333-4333-8333-333333333333';
    seedLesson([
      sentence(SENTENCE_A, 0),
      sentence(SENTENCE_B, 1),
      sentence(sentenceC, 2),
    ]);
    replaySyncedAttempt({
      sentenceId: SENTENCE_A,
      practicedAt: T0,
      passed: false,
    });
    db.execute(
      `INSERT INTO speaking_attempts (
        id, lesson_id, sentence_id, mode, practiced_at,
        check_full_sentence, check_key_words, check_rhythm,
        duration_ms, recording_id, revision, updated_at
      ) VALUES (?, ?, ?, 'shadowing', ?, 1, 1, 1, 1000, NULL, 2, ?);`,
      ['newer-a', LESSON_ID, SENTENCE_A, T1, T1],
    );
    replaySyncedAttempt({sentenceId: SENTENCE_B, practicedAt: T1});
    replaySyncedAttempt({
      sentenceId: STALE_SENTENCE,
      practicedAt: '2026-10-04T12:00:00.000Z',
      passed: false,
    });

    const pickerSummary = listShadowingLessonProgressSummaries()[0];
    const continueSummary = findMostRecentInProgressShadowingLesson();
    const entry = resolveShadowingEntry();

    expect(pickerSummary?.statusChip).toBe('Đang dở');
    expect(pickerSummary?.practicedSentenceCount).toBe(2);
    expect(pickerSummary?.reviewSentenceCount).toBe(0);
    expect(pickerSummary?.lastPracticedAt).toBe(T1);
    expect(pickerSummary?.resumeSentenceIndex).toBe(2);
    expect(continueSummary).toEqual(pickerSummary);
    expect(entry).toEqual({
      screen: 'ShadowingSession',
      lessonId: LESSON_ID,
      sentenceIndex: pickerSummary?.resumeSentenceIndex,
    });
  });
});
