/**
 * Tests for the lesson-runtime repository (SETE-108 / M3).
 *
 * Pins the row-mapping and the `content_review_items` upsert-on-conflict
 * behaviour the runtime engine depends on.
 */

import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {__resetMockDatabases} from '../../../../../../../test-utils/sqliteMock';
import {insertPackageRecord} from '../ContentPackageRepository';
import {
  getContentLessonById,
  getDueContentReviewItems,
  getLessonActivities,
  getLessonAudioAssets,
  getLessonChunks,
  getLessonSrsItems,
  insertContentReviewItems,
  listActivePackageLessons,
  listContentReviewItems,
  recordContentReviewEvent,
} from '../ContentRuntimeRepository';

const NOW = '2026-09-06T12:00:00.000Z';

function setup() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

function insertLesson(
  db: ReturnType<typeof open>,
  id: string,
  packageId: string,
) {
  db.execute(
    `INSERT INTO content_lessons (
      id, package_id, slug, schema_version, title_en, title_vi, blurb_vi,
      level, target_skills_json, estimated_duration_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      packageId,
      id,
      '0.1.0',
      `Title ${id}`,
      `Tiêu đề ${id}`,
      'blurb',
      'A2',
      JSON.stringify(['speaking']),
      15,
    ],
  );
}

function insertReviewItem(itemType: string) {
  insertContentReviewItems(
    'lesson-1',
    'pkg-1',
    [
      {
        id: `srs-${itemType}`,
        slug: `srs-${itemType}`,
        item_type: itemType as never,
        source_ref_id: 'chunk-1',
        front: 'Front',
        back: 'Back',
      },
    ],
    NOW,
  );
  return `review-srs-${itemType}`;
}

describe('ContentRuntimeRepository', () => {
  let db: ReturnType<typeof open>;

  beforeEach(() => {
    db = setup();
  });

  it('returns null for a missing lesson and empty arrays for its children', () => {
    expect(getContentLessonById('missing')).toBeNull();
    expect(getLessonChunks('missing')).toEqual([]);
    expect(getLessonActivities('missing')).toEqual([]);
    expect(getLessonSrsItems('missing')).toEqual([]);
    expect(getLessonAudioAssets('missing').size).toBe(0);
  });

  it('lists only lessons belonging to the active package', () => {
    insertPackageRecord({
      id: 'pkg-active',
      slug: 'active',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/a.zip',
      sha256: 'a',
      importedAt: NOW,
      isActive: true,
    });
    insertPackageRecord({
      id: 'pkg-old',
      slug: 'old',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/b.zip',
      sha256: 'b',
      importedAt: NOW,
      isActive: false,
    });
    insertLesson(db, 'lesson-active', 'pkg-active');
    insertLesson(db, 'lesson-old', 'pkg-old');

    const listed = listActivePackageLessons();
    expect(listed.map(l => l.id)).toEqual(['lesson-active']);
  });

  it('insertContentReviewItems upserts on srs_item_id and reports the created count', () => {
    const items = [
      {
        id: 'srs-1',
        slug: 'srs-1',
        item_type: 'vocabulary' as const,
        source_ref_id: 'chunk-1',
        front: 'Front',
        back: 'Back',
      },
    ];
    const first = insertContentReviewItems('lesson-1', 'pkg-1', items, NOW);
    expect(first.createdCount).toBe(1);

    const second = insertContentReviewItems('lesson-1', 'pkg-1', items, NOW);
    expect(second.createdCount).toBe(0);

    const rows = listContentReviewItems('lesson-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      srsItemId: 'srs-1',
      sourceRefId: 'chunk-1',
      masteryState: 'new',
    });
  });

  describe('recordContentReviewEvent (SETE-109 / M4)', () => {
    it('reschedules an M3 placeholder row on its first real review with no backfill', () => {
      const reviewItemId = insertReviewItem('vocabulary');

      const result = recordContentReviewEvent({
        reviewItemId,
        correct: true,
        reviewedAt: NOW,
      });

      expect(result).toMatchObject({
        ok: true,
        masteryState: 'learning',
        nextReviewAt: '2026-09-06T12:10:00.000Z',
      });
      expect(listContentReviewItems('lesson-1')[0]).toMatchObject({
        masteryState: 'learning',
        nextReviewAt: '2026-09-06T12:10:00.000Z',
      });
    });

    it('schedules vocabulary and dialogue_turn items identically (no per-type branching)', () => {
      const vocabId = insertReviewItem('vocabulary');
      const dialogueId = insertReviewItem('dialogue_turn');

      const vocabResult = recordContentReviewEvent({
        reviewItemId: vocabId,
        correct: true,
        reviewedAt: NOW,
      });
      const dialogueResult = recordContentReviewEvent({
        reviewItemId: dialogueId,
        correct: true,
        reviewedAt: NOW,
      });

      expect(dialogueResult).toEqual(vocabResult);
    });

    it('advances a fast, hint-free correct review further than a hinted/slow one', () => {
      const fastId = insertReviewItem('qa');
      recordContentReviewEvent({
        reviewItemId: fastId,
        correct: true,
        reviewedAt: NOW,
      });
      const fastSecond = recordContentReviewEvent({
        reviewItemId: fastId,
        correct: true,
        hintsUsed: 0,
        responseTimeMs: 1000,
        reviewedAt: '2026-09-06T12:10:00.000Z',
      });

      const hintedId = insertReviewItem('grammar');
      recordContentReviewEvent({
        reviewItemId: hintedId,
        correct: true,
        reviewedAt: NOW,
      });
      const hintedSecond = recordContentReviewEvent({
        reviewItemId: hintedId,
        correct: true,
        hintsUsed: 2,
        responseTimeMs: 15000,
        reviewedAt: '2026-09-06T12:10:00.000Z',
      });

      if (!fastSecond.ok || !hintedSecond.ok) {
        throw new Error('expected both review events to succeed');
      }
      expect(new Date(hintedSecond.nextReviewAt).getTime()).toBeLessThan(
        new Date(fastSecond.nextReviewAt).getTime(),
      );
    });

    it('returns an error for an unknown review item id', () => {
      const result = recordContentReviewEvent({
        reviewItemId: 'missing',
        correct: true,
      });
      expect(result).toMatchObject({
        ok: false,
        errorCode: 'REVIEW_ITEM_NOT_FOUND',
      });
    });
  });

  describe('getDueContentReviewItems', () => {
    it('selects only rows due at or before now, earliest first', () => {
      const dueId = insertReviewItem('vocabulary');
      const futureId = insertReviewItem('grammar');
      recordContentReviewEvent({
        reviewItemId: dueId,
        correct: true,
        reviewedAt: NOW,
      });
      recordContentReviewEvent({
        reviewItemId: futureId,
        correct: true,
        reviewedAt: '2026-09-06T12:05:00.000Z',
      });

      const due = getDueContentReviewItems({now: '2026-09-06T12:11:00.000Z'});
      expect(due.map(item => item.id)).toEqual([dueId]);
    });
  });
});
