import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import * as legacyLesson from '@features/youtube/logic/data/YouTubeLessonRepository';
import * as legacyProgress from '@features/youtube/logic/data/YouTubeProgressRepository';
import * as queryPort from '../../youtubeQueryPort';
import * as dataLesson from '../../data/YouTubeLessonRepository';
import * as dataProgress from '../../data/YouTubeProgressRepository';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';
import type {YouTubeTranscript} from '@core/schemas/youtube-transcript-v1';

/**
 * LING-104 adversarial review (INV-001 / INV-005, TASK-015 youtube/OCR
 * ownership). Exercises legacy shims and module public ports on real SQLite.
 */

const NOW = '2026-09-27T12:00:00.000Z';

const transcript: YouTubeTranscript = {
  schema_version: 'youtube-transcript-v1',
  video: {
    id: 'advYtube001',
    title: 'Adversarial lesson',
    channel_title: 'Lingo Bites',
    duration_seconds: 60,
    language: 'en',
    embeddable: true,
  },
  transcript_source: 'manual',
  segments: [
    {
      id: 'advYtube001-0',
      index: 0,
      start_ms: 0,
      end_ms: 1000,
      en: 'Test',
      vi: 'Thử',
      ipa: '/tɛst/',
    },
  ],
  warnings: [],
};

let dir: string;
let dbFile: string;

function coldStart(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  getDatabase();
  runMigrations(getDatabase());
  return connection;
}

function progressCount(lessonId: string): number {
  const row = getDatabase()
    .execute(
      'SELECT COUNT(*) AS n FROM youtube_progress WHERE lesson_id = ?;',
      [lessonId],
    )
    .rows?.item(0) as {n: number} | undefined;
  return row?.n ?? 0;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling104-adv-youtube-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
});

afterEach(() => {
  resetDatabaseForTests(null);
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('LING-104 youtube ownership (real SQLite / node:sqlite)', () => {
  it('legacy shims and module ports observe the same lesson/progress rows', () => {
    coldStart();

    expect(
      dataLesson.saveYouTubeLesson({lesson: transcript, now: NOW}),
    ).toEqual({
      ok: true,
      lessonId: transcript.video.id,
      duplicate: false,
    });
    expect(
      legacyLesson.saveYouTubeLesson({lesson: transcript, now: NOW}),
    ).toEqual({
      ok: true,
      lessonId: transcript.video.id,
      duplicate: true,
    });
    dataProgress.saveYouTubeProgress({
      lessonId: transcript.video.id,
      positionMs: 900,
      segmentIndex: 0,
      now: NOW,
    });

    expect(queryPort.getYouTubeLesson(transcript.video.id)).toEqual(
      legacyLesson.getYouTubeLesson(transcript.video.id),
    );
    expect(queryPort.getYouTubeProgress(transcript.video.id)).toEqual(
      legacyProgress.getYouTubeProgress(transcript.video.id),
    );
    expect(progressCount(transcript.video.id)).toBe(1);

    const repeat = dataLesson.saveYouTubeLesson({lesson: transcript, now: NOW});
    expect(repeat.ok && repeat.duplicate).toBe(true);
    expect(progressCount(transcript.video.id)).toBe(1);
  });
});
