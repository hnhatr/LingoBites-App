import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {YouTubeTranscript} from '@core/schemas/youtube-transcript-v1';

import {PRIOR_SCHEMA_403BC52} from '@test/support/adversarial/priorSchema403bc52';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';

import {
  getYouTubeLesson,
  getYouTubeProgress,
  listYouTubeLessons,
  saveYouTubeLesson,
  saveYouTubeProgress,
} from '../../youtubeQueryPort';

const NOW = '2026-09-27T12:00:00.000Z';
const T0 = '2026-09-10T08:00:00.000Z';
const PRIOR_LESSON_ID = 'priorVid001';

const priorTranscript: YouTubeTranscript = {
  schema_version: 'youtube-transcript-v1',
  video: {
    id: PRIOR_LESSON_ID,
    title: 'Prior saved lesson',
    channel_title: 'Lingo Bites',
    duration_seconds: 90,
    language: 'en',
    embeddable: true,
  },
  transcript_source: 'manual',
  segments: [
    {
      id: `${PRIOR_LESSON_ID}-0`,
      index: 0,
      start_ms: 0,
      end_ms: 2000,
      en: 'Prior line.',
      vi: 'Câu cũ.',
      ipa: '/paɪər/',
    },
  ],
  warnings: [],
};

let dir: string;
let dbFile: string;

function countRows(sql: string, params: unknown[] = []): number {
  const result = getDatabase().execute(sql, params as never[]);
  const row = result.rows?.item(0) as {n: number} | undefined;
  return row?.n ?? 0;
}

function expectNoLessonOrProgressDuplicates(lessonId = PRIOR_LESSON_ID): void {
  expect(
    countRows('SELECT COUNT(*) AS n FROM youtube_lessons WHERE id = ?;', [
      lessonId,
    ]),
  ).toBe(1);
  expect(
    countRows(
      'SELECT COUNT(*) AS n FROM youtube_progress WHERE lesson_id = ?;',
      [lessonId],
    ),
  ).toBe(1);
  expect(
    countRows(
      'SELECT COUNT(*) AS n FROM youtube_sentences WHERE lesson_id = ?;',
      [lessonId],
    ),
  ).toBe(priorTranscript.segments.length);
}

function seedPriorYouTubeInstall(raw: RealSqliteConnection): void {
  for (const sql of PRIOR_SCHEMA_403BC52) {
    try {
      raw.execute(sql);
    } catch (error) {
      if (!String((error as Error).message).includes('duplicate column')) {
        throw error;
      }
    }
  }
  const exec = (sql: string, params: unknown[]) =>
    raw.execute(sql, params as never[]);
  exec(
    `INSERT INTO youtube_lessons (
      id, schema_version, video_id, title, channel_title, duration_seconds,
      language, embeddable, transcript_source, warnings_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      PRIOR_LESSON_ID,
      priorTranscript.schema_version,
      PRIOR_LESSON_ID,
      priorTranscript.video.title,
      priorTranscript.video.channel_title,
      priorTranscript.video.duration_seconds,
      priorTranscript.video.language,
      priorTranscript.video.embeddable ? 1 : 0,
      priorTranscript.transcript_source,
      JSON.stringify(priorTranscript.warnings),
      T0,
      T0,
    ],
  );
  for (const segment of priorTranscript.segments) {
    exec(
      `INSERT INTO youtube_sentences (
        lesson_id, sentence_id, idx, start_ms, end_ms, en, vi, ipa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        PRIOR_LESSON_ID,
        segment.id,
        segment.index,
        segment.start_ms,
        segment.end_ms,
        segment.en,
        segment.vi,
        segment.ipa,
      ],
    );
  }
  exec(
    `INSERT INTO youtube_progress (
      lesson_id, position_ms, segment_index, updated_at
    ) VALUES (?, ?, ?, ?)`,
    [PRIOR_LESSON_ID, 3200, 0, T0],
  );
}

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  return connection;
}

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('youtube domain ownership (real SQLite / node:sqlite)', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ling104-youtube-real-sqlite-'),
    );
    dbFile = path.join(dir, 'lingobites.sqlite');
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: lesson and resume progress survive reopen via @features/youtube`, () => {
    let db = coldStart();
    runMigrations(getDatabase());

    const saved = saveYouTubeLesson({lesson: priorTranscript, now: NOW});
    expect(saved).toEqual({
      ok: true,
      lessonId: PRIOR_LESSON_ID,
      duplicate: false,
    });
    saveYouTubeProgress({
      lessonId: PRIOR_LESSON_ID,
      positionMs: 4100,
      segmentIndex: 0,
      now: NOW,
    });

    expect(getYouTubeLesson(PRIOR_LESSON_ID)).toMatchObject({
      video: {id: PRIOR_LESSON_ID, title: priorTranscript.video.title},
    });
    expect(getYouTubeProgress(PRIOR_LESSON_ID)).toMatchObject({
      lessonId: PRIOR_LESSON_ID,
      positionMs: 4100,
      segmentIndex: 0,
    });
    expectNoLessonOrProgressDuplicates();

    db.close();
    db = coldStart();
    expect(getYouTubeLesson(PRIOR_LESSON_ID)?.video.id).toBe(PRIOR_LESSON_ID);
    expect(getYouTubeProgress(PRIOR_LESSON_ID)?.positionMs).toBe(4100);
    expectNoLessonOrProgressDuplicates();

    runMigrations(getDatabase());
    runMigrations(getDatabase());
    expect(listYouTubeLessons().map(lesson => lesson.video.id)).toContain(
      PRIOR_LESSON_ID,
    );
    expectNoLessonOrProgressDuplicates();
  });
});

describe('youtube prior-schema upgrade-read (real SQLite / node:sqlite)', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ling104-youtube-prior-real-sqlite-'),
    );
    dbFile = path.join(dir, 'lingobites.sqlite');
    const prior = openRealSqlite(dbFile);
    seedPriorYouTubeInstall(prior);
    prior.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_001}: pre-move lesson/progress upgrade-read through @features/youtube`, () => {
    let db = coldStart();

    expect(getYouTubeLesson(PRIOR_LESSON_ID)).toMatchObject({
      video: {id: PRIOR_LESSON_ID, title: 'Prior saved lesson'},
      segments: [{en: 'Prior line.'}],
    });
    expect(getYouTubeProgress(PRIOR_LESSON_ID)).toMatchObject({
      lessonId: PRIOR_LESSON_ID,
      positionMs: 3200,
      segmentIndex: 0,
    });
    expectNoLessonOrProgressDuplicates();

    runMigrations(getDatabase());
    runMigrations(getDatabase());
    expect(getYouTubeProgress(PRIOR_LESSON_ID)?.positionMs).toBe(3200);
    expectNoLessonOrProgressDuplicates();

    db.close();
    db = coldStart();
    expect(getYouTubeLesson(PRIOR_LESSON_ID)?.video.id).toBe(PRIOR_LESSON_ID);
    expect(getYouTubeProgress(PRIOR_LESSON_ID)?.lessonId).toBe(PRIOR_LESSON_ID);
    expectNoLessonOrProgressDuplicates();
    db.close();
  });

  it(`${CHARACTERIZATION_INVARIANTS.INV_005}: idempotent lesson save and progress upsert do not duplicate rows after prior-schema upgrade`, () => {
    const db = coldStart();

    const firstSave = saveYouTubeLesson({
      lesson: priorTranscript,
      now: NOW,
    });
    const secondSave = saveYouTubeLesson({
      lesson: priorTranscript,
      now: NOW,
    });
    expect(firstSave.ok && firstSave.duplicate).toBe(true);
    expect(secondSave.ok && secondSave.duplicate).toBe(true);

    saveYouTubeProgress({
      lessonId: PRIOR_LESSON_ID,
      positionMs: 5000,
      segmentIndex: 0,
      now: NOW,
    });
    saveYouTubeProgress({
      lessonId: PRIOR_LESSON_ID,
      positionMs: 5000,
      segmentIndex: 0,
      now: NOW,
    });
    expect(getYouTubeProgress(PRIOR_LESSON_ID)?.positionMs).toBe(5000);
    expectNoLessonOrProgressDuplicates();

    db.close();
    coldStart();
    runMigrations(getDatabase());
    expectNoLessonOrProgressDuplicates();
  });
});
