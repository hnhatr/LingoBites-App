import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {saveLessonSnapshotBody} from '@features/lesson/player/logic/canonicalDownloadRepository';
import {replaceSpeakingAttemptForSentence} from '@features/speaking/logic/data/SpeakingAttemptRepository';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {LessonSentence} from '@core/schemas/lesson';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {orderShadowingSentences} from '../shadowingLessons';
import {
  computeShadowingLessonProgress,
  lessonHasShadowingAttempts,
  listShadowingLessonProgressSummaries,
  resolveShadowingEntry,
  summarizeShadowingLessonProgress,
} from '../shadowingProgress';

const LESSON_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const LESSON_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';
const LESSON_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03';
const LESSON_EMPTY = 'dddddddd-dddd-4ddd-8ddd-dddddddddd04';
const T0 = '2026-10-04T10:00:00.000Z';

let dbPath: string;
let db: RealSqliteConnection;

function sentence(id: string, position: number): LessonSentence {
  return {
    id,
    position,
    text_en: `en-${position}`,
    text_vi: `vi-${position}`,
    ipa: `/ipa-${position}/`,
    start_ms: null,
    end_ms: null,
  };
}

const SENTENCE_ID_PREFIX: Record<string, string> = {
  [LESSON_A]: '11111111-1111-4111-8111-',
  [LESSON_B]: '22222222-2222-4222-8222-',
  [LESSON_C]: '33333333-3333-4333-8333-',
};

function sentenceIdFor(lessonId: string, index: number): string {
  const prefix = SENTENCE_ID_PREFIX[lessonId] ?? '44444444-4444-4444-8444-';
  return `${prefix}${String(index).padStart(12, '0')}`;
}

function sentencesForLesson(lessonId: string, count: number): LessonSentence[] {
  return Array.from({length: count}, (_, index) =>
    sentence(sentenceIdFor(lessonId, index), index),
  );
}

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

function seedLessonDownload(
  lessonId: string,
  title: string,
  sentences: LessonSentence[],
) {
  const body = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as {
    lesson: {id: string; title: string; sentences: LessonSentence[]};
  };
  body.lesson.id = lessonId;
  body.lesson.title = title;
  body.lesson.sentences = sentences;
  saveLessonSnapshotBody({body});
}

function seedAttempt(
  lessonId: string,
  sentenceId: string,
  practicedAt: string,
  checks: {full: boolean; keys: boolean; rhythm: boolean},
) {
  replaceSpeakingAttemptForSentence({
    id: `attempt-${sentenceId}`,
    lessonId,
    sentenceId,
    mode: 'shadowing',
    practicedAt,
    checkFullSentence: checks.full,
    checkKeyWords: checks.keys,
    checkRhythm: checks.rhythm,
    durationMs: 1200,
    recordingId: `rec-${sentenceId}`,
  });
}

beforeEach(() => {
  dbPath = path.join(
    os.tmpdir(),
    `ling244-shadowing-progress-${Date.now()}-${Math.random()}.sqlite`,
  );
  db = openRealSqlite(dbPath);
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  db.close();
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore
  }
});

describe('shadowingProgress (BR-008)', () => {
  beforeEach(() => {
    seedLessonDownload(LESSON_A, 'Lesson A', sentencesForLesson(LESSON_A, 8));
    const bSentences = sentencesForLesson(LESSON_B, 12);
    seedLessonDownload(LESSON_B, 'Lesson B', bSentences);
    const cSentences = sentencesForLesson(LESSON_C, 6);
    seedLessonDownload(LESSON_C, 'Lesson C', cSentences);
    seedLessonDownload(LESSON_EMPTY, 'Empty lesson', []);

    for (let i = 0; i < 4; i += 1) {
      seedAttempt(
        LESSON_B,
        sentenceIdFor(LESSON_B, i),
        `2026-10-04T10:0${i}:00.000Z`,
        {
          full: true,
          keys: true,
          rhythm: true,
        },
      );
    }

    const lastC = cSentences[cSentences.length - 1]!.id;
    seedAttempt(LESSON_C, lastC, '2026-10-04T11:00:00.000Z', {
      full: false,
      keys: true,
      rhythm: true,
    });
    seedAttempt(
      LESSON_C,
      sentenceIdFor(LESSON_C, 1),
      '2026-10-04T10:01:00.000Z',
      {
        full: false,
        keys: false,
        rhythm: true,
      },
    );
    seedAttempt(
      LESSON_C,
      sentenceIdFor(LESSON_C, 3),
      '2026-10-04T10:02:00.000Z',
      {
        full: true,
        keys: false,
        rhythm: false,
      },
    );
  });

  it('AC-003 S1: reports Chưa luyện, Đang dở and Xong with counts', () => {
    const summaries = listShadowingLessonProgressSummaries();
    const a = summaries.find(s => s.lessonId === LESSON_A);
    const b = summaries.find(s => s.lessonId === LESSON_B);
    const c = summaries.find(s => s.lessonId === LESSON_C);

    expect(a?.statusChip).toBe('Chưa luyện');
    expect(b?.statusChip).toBe('Đang dở');
    expect(b?.practicedSentenceCount).toBe(4);
    expect(b?.sentenceCount).toBe(12);
    expect(c?.statusChip).toBe('Xong');
    expect(c?.reviewSentenceCount).toBe(3);
  });

  it('AC-003 S2: omits downloaded lessons with zero sentences', () => {
    const ids = listShadowingLessonProgressSummaries().map(s => s.lessonId);
    expect(ids).not.toContain(LESSON_EMPTY);
  });

  it('AC-004 S1/S2: resume index matches BR-008 for in-progress and finished lessons', () => {
    const b = summarizeShadowingLessonProgress(LESSON_B);
    const c = summarizeShadowingLessonProgress(LESSON_C);
    expect(b?.resumeSentenceIndex).toBe(4);
    expect(b?.resumeSentenceNumber).toBe(5);
    expect(c?.resumeSentenceIndex).toBe(0);
    expect(c?.resumeSentenceNumber).toBe(1);
  });

  it('EC-012: ignores attempts for sentence ids no longer in the snapshot', () => {
    const sentences = sentencesForLesson(LESSON_A, 2);
    seedLessonDownload(LESSON_A, 'Lesson A', sentences);
    seedAttempt(LESSON_A, '99999999-9999-4999-8999-999999999999', T0, {
      full: true,
      keys: true,
      rhythm: true,
    });
    const summary = summarizeShadowingLessonProgress(LESSON_A);
    expect(summary?.practicedSentenceCount).toBe(0);
    expect(summary?.statusChip).toBe('Chưa luyện');
  });

  it('BR-008 invariant: lessons without attempts never report resume progress', () => {
    const summary = summarizeShadowingLessonProgress(LESSON_A)!;
    expect(lessonHasShadowingAttempts(summary)).toBe(false);
    expect(summary.resumeSentenceIndex).toBe(0);
    const pickerResume = summary.resumeSentenceIndex;
    const direct = computeShadowingLessonProgress(
      summary.lessonId,
      summary.titleVi,
      orderShadowingSentences(sentencesForLesson(LESSON_A, 8)),
      [],
      summary.estimatedMinutes,
    );
    expect(direct?.resumeSentenceIndex).toBe(pickerResume);
  });

  it('resolveShadowingEntry opens in-progress session at resume sentence', () => {
    const entry = resolveShadowingEntry();
    expect(entry).toEqual({
      screen: 'ShadowingSession',
      lessonId: LESSON_B,
      sentenceIndex: 4,
    });
  });
});
