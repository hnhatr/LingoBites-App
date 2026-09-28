import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {
  deleteYouTubeLesson,
  getYouTubeLesson,
  listYouTubeLessons,
  saveYouTubeLesson,
} from '../YouTubeLessonRepository';
import type {YouTubeTranscript} from '@core/schemas/youtube-transcript-v1';

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
  warnings: ['one block used fallback enrichment'],
};

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  runMigrations(getDatabase());
});

describe('YouTubeLessonRepository', () => {
  it('round-trips the complete lesson and keeps sentence order', () => {
    expect(
      saveYouTubeLesson({lesson: transcript, now: '2026-09-10T00:00:00.000Z'}),
    ).toEqual({
      ok: true,
      lessonId: transcript.video.id,
      duplicate: false,
    });

    expect(getYouTubeLesson(transcript.video.id)).toEqual(transcript);
    expect(listYouTubeLessons()).toEqual([transcript]);
  });

  it('replaces an existing lesson atomically and removes stale child sentences', () => {
    saveYouTubeLesson({lesson: transcript, now: '2026-09-10T00:00:00.000Z'});
    const replacement: YouTubeTranscript = {
      ...transcript,
      video: {...transcript.video, title: 'Updated title'},
      segments: [transcript.segments[0]],
    };

    expect(
      saveYouTubeLesson({lesson: replacement, now: '2026-09-10T01:00:00.000Z'}),
    ).toEqual({ok: true, lessonId: transcript.video.id, duplicate: true});
    expect(getYouTubeLesson(transcript.video.id)).toEqual(replacement);

    const sentenceCount = getDatabase().execute(
      'SELECT COUNT(*) AS count FROM youtube_sentences WHERE lesson_id = ?;',
      [transcript.video.id],
    );
    expect(sentenceCount.rows?.item(0)).toEqual({count: 1});
  });

  it('deletes the lesson and all sentence rows', () => {
    saveYouTubeLesson({lesson: transcript});

    expect(deleteYouTubeLesson(transcript.video.id)).toBe(true);
    expect(getYouTubeLesson(transcript.video.id)).toBeNull();
    expect(listYouTubeLessons()).toEqual([]);
    expect(
      getDatabase()
        .execute('SELECT COUNT(*) AS count FROM youtube_sentences;', [])
        .rows?.item(0),
    ).toEqual({count: 0});
  });

  it('keeps existing data when the new migration runs again', () => {
    getDatabase().execute(
      'INSERT INTO lessons (id, anonymous_user_id, lesson_input_hash, title, source_type, confirmed_text, vietnamese_translation, level, ai_output_json, is_saved, created_at, updated_at, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        'legacy',
        'anon',
        'hash',
        'Old lesson',
        'paste_text',
        'text',
        'văn bản',
        'A1',
        '{}',
        1,
        'now',
        'now',
        'vocabulary',
      ],
    );

    runMigrations(getDatabase());

    expect(
      getDatabase()
        .execute('SELECT * FROM lessons WHERE id = ?;', ['legacy'])
        .rows?.item(0),
    ).toMatchObject({id: 'legacy', title: 'Old lesson'});
    expect(getYouTubeLesson(transcript.video.id)).toBeNull();
  });
});
