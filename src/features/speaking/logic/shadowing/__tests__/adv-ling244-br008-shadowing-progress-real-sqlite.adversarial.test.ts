import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {saveLessonSnapshotBody} from '@features/lesson/player/logic/canonicalDownloadRepository';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {LessonSentence} from '@core/schemas/lesson';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {summarizeShadowingLessonProgress} from '../shadowingProgress';

const LESSON_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SENTENCE_1 = '11111111-1111-4111-8111-111111111111';
const SENTENCE_2 = '22222222-2222-4222-8222-222222222222';
const OLDER = '2026-10-04T10:00:00.000Z';
const NEWER = '2026-10-04T10:01:00.000Z';

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
    text_en: `en-${position}`,
    text_vi: `vi-${position}`,
    ipa: `/ipa-${position}/`,
    start_ms: null,
    end_ms: null,
  };
}

function seedLesson() {
  const body = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as {
    lesson: {id: string; title: string; sentences: LessonSentence[]};
  };
  body.lesson.id = LESSON_ID;
  body.lesson.title = 'Adversarial lesson';
  body.lesson.sentences = [sentence(SENTENCE_1, 0), sentence(SENTENCE_2, 1)];
  saveLessonSnapshotBody({body});
}

function insertAttempt(input: {
  id: string;
  practicedAt: string;
  passed: boolean;
  sentenceId?: string;
}) {
  db.execute(
    `INSERT INTO speaking_attempts (
      id, lesson_id, sentence_id, mode, practiced_at,
      check_full_sentence, check_key_words, check_rhythm,
      duration_ms, recording_id, revision, updated_at
    ) VALUES (?, ?, ?, 'shadowing', ?, ?, ?, ?, 1000, NULL, 1, ?);`,
    [
      input.id,
      LESSON_ID,
      input.sentenceId ?? SENTENCE_1,
      input.practicedAt,
      input.passed ? 1 : 0,
      input.passed ? 1 : 0,
      input.passed ? 1 : 0,
      input.practicedAt,
    ],
  );
}

beforeEach(() => {
  dbPath = path.join(
    os.tmpdir(),
    `ling244-adversarial-${Date.now()}-${Math.random()}.sqlite`,
  );
  db = openRealSqlite(dbPath);
  resetDatabaseForTests(db);
  runMigrations(db);
  seedLesson();
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

describe('LING-244 adversarial BR-008 coverage', () => {
  it('ADV-001 / INV-BR-008: review count uses the latest attempt when duplicate rows exist', () => {
    insertAttempt({id: 'older-failed', practicedAt: OLDER, passed: false});
    insertAttempt({id: 'newer-passed', practicedAt: NEWER, passed: true});

    const summary = summarizeShadowingLessonProgress(LESSON_ID);

    expect(summary?.practicedSentenceCount).toBe(1);
    expect(summary?.reviewSentenceCount).toBe(0);
  });

  it('ADV-003 / INV-BR-008: a latest failed duplicate remains counted for review', () => {
    insertAttempt({id: 'older-passed', practicedAt: OLDER, passed: true});
    insertAttempt({id: 'newer-failed', practicedAt: NEWER, passed: false});

    const summary = summarizeShadowingLessonProgress(LESSON_ID);

    expect(summary?.practicedSentenceCount).toBe(1);
    expect(summary?.reviewSentenceCount).toBe(1);
  });

  it('ADV-002 / INV-BR-008: tied attempt times resolve to the same resume index across row replay order', () => {
    insertAttempt({
      id: 'sentence-1',
      practicedAt: NEWER,
      passed: true,
      sentenceId: SENTENCE_1,
    });
    insertAttempt({
      id: 'sentence-2',
      practicedAt: NEWER,
      passed: true,
      sentenceId: SENTENCE_2,
    });
    const beforeReplay = summarizeShadowingLessonProgress(LESSON_ID);

    db.execute('DELETE FROM speaking_attempts;');
    insertAttempt({
      id: 'sentence-2',
      practicedAt: NEWER,
      passed: true,
      sentenceId: SENTENCE_2,
    });
    insertAttempt({
      id: 'sentence-1',
      practicedAt: NEWER,
      passed: true,
      sentenceId: SENTENCE_1,
    });
    const afterReplay = summarizeShadowingLessonProgress(LESSON_ID);

    expect(afterReplay?.resumeSentenceIndex).toBe(
      beforeReplay?.resumeSentenceIndex,
    );
  });
});
