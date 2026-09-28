import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {
  clearYouTubeProgress,
  getYouTubeProgress,
  saveYouTubeProgress,
} from '../YouTubeProgressRepository';
import {
  deleteYouTubeLesson,
  saveYouTubeLesson,
} from '../YouTubeLessonRepository';
import type {YouTubeTranscript} from '@shared/schemas/youtube-transcript-v1';

const transcript: YouTubeTranscript = {
  schema_version: 'youtube-transcript-v1',
  video: {
    id: 'dQw4w9WgXcQ',
    title: 'A saved lesson',
    channel_title: 'Lingo Bites',
    duration_seconds: 120,
    language: 'en',
    embeddable: true,
  },
  transcript_source: 'manual',
  segments: [
    {
      id: 'dQw4w9WgXcQ-0',
      index: 0,
      start_ms: 0,
      end_ms: 1200,
      en: 'Hello there.',
      vi: 'Xin chào.',
      ipa: '/həˈloʊ ðer/',
    },
    {
      id: 'dQw4w9WgXcQ-1',
      index: 1,
      start_ms: 1500,
      end_ms: 3000,
      en: 'Welcome back.',
      vi: 'Mừng bạn quay lại.',
      ipa: '/ˈwɛlkəm bæk/',
    },
  ],
  warnings: [],
};

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  runMigrations(getDatabase());
});

describe('YouTubeProgressRepository (SETE-290 DEV-3)', () => {
  it('returns null when nothing was saved', () => {
    expect(getYouTubeProgress('missing')).toBeNull();
  });

  it('round-trips timestamp and sentence index per video', () => {
    expect(
      saveYouTubeProgress({
        lessonId: 'video-a',
        positionMs: 4500,
        segmentIndex: 1,

        now: '2026-09-13T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(getYouTubeProgress('video-a')).toEqual({
      lessonId: 'video-a',
      positionMs: 4500,
      revision: 0,
      segmentIndex: 1,
      tombstone: false,
      updatedAt: '2026-09-13T00:00:00.000Z',
    });
  });

  it('keeps each video independent and replaces on re-save', () => {
    saveYouTubeProgress({
      lessonId: 'video-a',
      positionMs: 1000,
      segmentIndex: 0,
    });
    saveYouTubeProgress({
      lessonId: 'video-b',
      positionMs: 9000,
      segmentIndex: 3,
    });
    saveYouTubeProgress({
      lessonId: 'video-a',
      positionMs: 2000,
      segmentIndex: 1,
    });

    expect(getYouTubeProgress('video-a')).toMatchObject({
      positionMs: 2000,
      segmentIndex: 1,
    });
    expect(getYouTubeProgress('video-b')).toMatchObject({
      positionMs: 9000,
      segmentIndex: 3,
    });
  });

  it('clears a single video without touching the others', () => {
    saveYouTubeProgress({
      lessonId: 'video-a',
      positionMs: 1000,
      segmentIndex: 0,
    });
    saveYouTubeProgress({
      lessonId: 'video-b',
      positionMs: 9000,
      segmentIndex: 3,
    });

    expect(clearYouTubeProgress('video-a')).toBe(true);
    expect(getYouTubeProgress('video-a')).toBeNull();
    expect(getYouTubeProgress('video-b')).not.toBeNull();
  });

  it('deleting a lesson deletes its progress row', () => {
    saveYouTubeLesson({lesson: transcript});
    saveYouTubeProgress({
      lessonId: transcript.video.id,
      positionMs: 2000,
      segmentIndex: 1,
    });

    expect(deleteYouTubeLesson(transcript.video.id)).toBe(true);
    expect(getYouTubeProgress(transcript.video.id)).toBeNull();
  });
});
