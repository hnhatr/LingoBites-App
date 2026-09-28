/**
 * Tests for the Speaking Room recordings + Error Notebook repository
 * (SETE-110 / M5).
 *
 * Pins: recording CRUD, automatic error->review-item linkage surfacing via
 * the M4 due-item query, and CHANGE-S3 delete-my-data scoping (only this
 * milestone's rows, never M3/M4 lesson-runtime review items).
 */

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  captureErrorEvent,
  clearSpeakingData,
  deleteSpeakingRecording,
  insertSpeakingRecording,
  listErrorEvents,
  listSpeakingRecordings,
} from '../SpeakingRepository';
import {
  getDueContentReviewItems,
  insertContentReviewItems,
  listContentReviewItems,
} from '@shared/db/ContentRuntimeRepository';

const NOW = '2026-09-06T12:00:00.000Z';

function setup() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

describe('SpeakingRepository recordings', () => {
  beforeEach(() => setup());

  it('inserts and lists a recording', () => {
    insertSpeakingRecording({
      id: 'rec-1',
      lessonId: 'lesson-1',
      mode: 'shadowing',
      filePath: '/docs/rec-1.m4a',
      durationMs: 4200,
      createdAt: NOW,
    });

    const all = listSpeakingRecordings();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id: 'rec-1',
      lessonId: 'lesson-1',
      mode: 'shadowing',
      filePath: '/docs/rec-1.m4a',
      durationMs: 4200,
    });

    expect(listSpeakingRecordings('lesson-1')).toHaveLength(1);
    expect(listSpeakingRecordings('other-lesson')).toHaveLength(0);
  });

  it('deletes a recording and returns its file path for the caller to unlink', () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'quick_answer',
      filePath: '/docs/rec-1.m4a',
      durationMs: 1000,
      createdAt: NOW,
    });

    const deleted = deleteSpeakingRecording('rec-1');
    expect(deleted).toEqual({filePath: '/docs/rec-1.m4a'});
    expect(listSpeakingRecordings()).toHaveLength(0);
    expect(deleteSpeakingRecording('missing')).toBeNull();
  });
});

describe('SpeakingRepository error notebook', () => {
  beforeEach(() => setup());

  it('automatically creates a linked review item surfaced by the M4 due-item query', () => {
    const {errorEvent, reviewItemId} = captureErrorEvent({
      id: 'err-1',
      source: 'speaking_room',
      category: 'pronunciation_affecting_meaning',
      lessonId: 'lesson-1',
      activityId: 'activity-1',
      createdAt: NOW,
    });

    expect(errorEvent.reviewItemId).toBe(reviewItemId);
    expect(listErrorEvents()).toHaveLength(1);
    expect(listErrorEvents('lesson-1')).toHaveLength(1);

    const reviewItems = listContentReviewItems('lesson-1');
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].itemType).toBe('speaking_error');
    expect(reviewItems[0].id).toBe(reviewItemId);

    // Placeholder next_review_at is now + 1 day, so it is due "tomorrow and
    // later" — asserting the M4 query surfaces it once due confirms the
    // linkage without depending on internal review-item fields.
    const dueLater = getDueContentReviewItems({
      now: '2026-09-08T00:00:00.000Z',
    });
    expect(dueLater.map(item => item.id)).toContain(reviewItemId);

    const dueNow = getDueContentReviewItems({now: NOW});
    expect(dueNow.map(item => item.id)).not.toContain(reviewItemId);
  });

  it('never stores raw learner text — only category/timestamps/outcome (CON-6)', () => {
    captureErrorEvent({
      id: 'err-1',
      source: 'lesson_runtime',
      category: 'vocabulary',
      lessonId: 'lesson-1',
      createdAt: NOW,
    });

    const [event] = listErrorEvents();
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/spoken|transcript|audio/i);
    expect(Object.keys(event).sort()).toEqual(
      [
        'activityId',
        'category',
        'createdAt',
        'id',
        'lessonId',
        'reviewItemId',
        'source',
      ].sort(),
    );
  });
});

describe('SpeakingRepository clearSpeakingData (CHANGE-S3)', () => {
  beforeEach(() => setup());

  it('deletes recordings, error events, and only this milestone review items', () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/docs/rec-1.m4a',
      durationMs: 500,
      createdAt: NOW,
    });
    captureErrorEvent({
      id: 'err-1',
      source: 'speaking_room',
      category: 'listening',
      lessonId: 'lesson-1',
      createdAt: NOW,
    });
    // An M3/M4 lesson-runtime review item must survive the M5 wipe.
    insertContentReviewItems(
      'lesson-1',
      'pkg-1',
      [
        {
          id: 'srs-1',
          slug: 'srs-1',
          item_type: 'vocabulary',
          source_ref_id: 'chunk-1',
          front: 'Front',
          back: 'Back',
        },
      ],
      NOW,
    );

    const {deletedFilePaths} = clearSpeakingData();
    expect(deletedFilePaths).toEqual(['/docs/rec-1.m4a']);

    expect(listSpeakingRecordings()).toHaveLength(0);
    expect(listErrorEvents()).toHaveLength(0);

    const remainingReviewItems = listContentReviewItems('lesson-1');
    expect(remainingReviewItems).toHaveLength(1);
    expect(remainingReviewItems[0].itemType).toBe('vocabulary');
  });
});
