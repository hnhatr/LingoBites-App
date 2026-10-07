import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {SyncCollectionSchema} from '@core/schemas/sync';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  applyLessonBookmarkRecord,
  isLessonBookmarked,
  listLessonBookmarks,
  removeLessonBookmark,
  saveLessonBookmark,
  subscribeLessonBookmarks,
} from '../lessonBookmarks';

type Row = Record<string, any>;

function rows(sql: string): Row[] {
  const result = getDatabase().execute(sql).rows;
  const out: Row[] = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) {
    out.push(result!.item(i) as Row);
  }
  return out;
}

const LESSON = '11111111-1111-4111-8111-111111111111';
const T1 = '2026-10-06T10:00:00.000Z';
const T2 = '2026-10-06T11:00:00.000Z';
const T3 = '2026-10-06T12:00:00.000Z';

const card = {
  lessonId: LESSON,
  title: '  Seeing an Old Friend Again · Gặp lại người bạn cũ ',
  sourceType: 'admin_text' as const,
  sentenceCount: 24,
  estimatedMinutes: 12,
  contextLabel: 'Getting Started · A1',
};

function pulled(overrides: Record<string, unknown> = {}) {
  return {
    collection: 'lesson_bookmarks',
    entity_id: LESSON,
    payload: {
      title: 'Seeing an Old Friend Again',
      source_type: 'youtube',
      sentence_count: 18,
      estimated_minutes: null,
      context_label: null,
    },
    revision: 7,
    occurred_at: T2,
    updated_at: T2,
    tombstone: false,
    ...overrides,
  };
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  getDatabase();
});

describe('lesson bookmarks', () => {
  it('is an allowlisted sync collection', () => {
    expect(SyncCollectionSchema.safeParse('lesson_bookmarks').success).toBe(
      true,
    );
  });

  it('saves the card fields and queues the server payload in one go', () => {
    expect(saveLessonBookmark({...card, now: T1})).toBe(true);

    expect(isLessonBookmarked(LESSON)).toBe(true);
    expect(listLessonBookmarks()).toEqual([
      {
        lessonId: LESSON,
        title: 'Seeing an Old Friend Again · Gặp lại người bạn cũ',
        sourceType: 'admin_text',
        sentenceCount: 24,
        estimatedMinutes: 12,
        contextLabel: 'Getting Started · A1',
        savedAt: T1,
      },
    ]);
    const outbox = rows('SELECT * FROM sync_outbox;');
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      event_type: 'lesson_bookmarks',
      entity_id: LESSON,
      created_at: T1,
    });
    expect(JSON.parse(outbox[0]!.payload_json)).toEqual({
      title: 'Seeing an Old Friend Again · Gặp lại người bạn cũ',
      source_type: 'admin_text',
      sentence_count: 24,
      estimated_minutes: 12,
      context_label: 'Getting Started · A1',
    });
  });

  it('drops a zero duration and a blank context instead of failing the push', () => {
    saveLessonBookmark({
      ...card,
      estimatedMinutes: 0,
      contextLabel: '  ',
      now: T1,
    });
    const payload = JSON.parse(
      rows('SELECT payload_json FROM sync_outbox;')[0]!.payload_json,
    );
    expect(payload.estimated_minutes).toBeNull();
    expect(payload.context_label).toBeNull();
  });

  it('refuses a lesson with no title', () => {
    expect(saveLessonBookmark({...card, title: '   '})).toBe(false);
    expect(rows('SELECT * FROM sync_outbox;')).toHaveLength(0);
  });

  it('unsaving queues a tombstone and hides the lesson', () => {
    saveLessonBookmark({...card, now: T1});
    expect(removeLessonBookmark(LESSON, T2)).toBe(true);

    expect(isLessonBookmarked(LESSON)).toBe(false);
    expect(listLessonBookmarks()).toEqual([]);
    const outbox = rows('SELECT * FROM sync_outbox ORDER BY created_at;');
    expect(JSON.parse(outbox[1]!.payload_json)).toEqual({tombstone: true});
    // Unsaving twice queues nothing new.
    expect(removeLessonBookmark(LESSON, T3)).toBe(false);
    expect(rows('SELECT * FROM sync_outbox;')).toHaveLength(2);
  });

  it('a pulled save shows up on a device that never had it', () => {
    applyLessonBookmarkRecord(pulled());
    expect(listLessonBookmarks()).toEqual([
      {
        lessonId: LESSON,
        title: 'Seeing an Old Friend Again',
        sourceType: 'youtube',
        sentenceCount: 18,
        estimatedMinutes: null,
        contextLabel: null,
        savedAt: T2,
      },
    ]);
  });

  it('a newer pulled unsave removes a local save', () => {
    saveLessonBookmark({...card, now: T1});
    applyLessonBookmarkRecord(pulled({tombstone: true, payload: {}}));
    expect(isLessonBookmarked(LESSON)).toBe(false);
  });

  it('a local change newer than the pulled record wins', () => {
    saveLessonBookmark({...card, now: T3});
    applyLessonBookmarkRecord(pulled({tombstone: true, payload: {}}));
    expect(isLessonBookmarked(LESSON)).toBe(true);

    removeLessonBookmark(LESSON, T3);
    applyLessonBookmarkRecord(pulled());
    expect(isLessonBookmarked(LESSON)).toBe(false);
  });

  it('skips a pulled payload it cannot read', () => {
    applyLessonBookmarkRecord(pulled({payload: {title: ''}}));
    expect(listLessonBookmarks()).toEqual([]);
  });

  it('tells subscribers about local and pulled changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLessonBookmarks(listener);
    saveLessonBookmark({...card, now: T1});
    removeLessonBookmark(LESSON, T2);
    applyLessonBookmarkRecord(pulled({occurred_at: T3}));
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    removeLessonBookmark(LESSON);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
