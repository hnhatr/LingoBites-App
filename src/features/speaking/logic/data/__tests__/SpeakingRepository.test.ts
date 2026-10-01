/**
 * Tests for the Speaking Room recordings + Error Notebook repository
 * (SETE-110 / M5, LING-149 TASK-008).
 */

import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {
  captureErrorEvent,
  clearSpeakingData,
  deleteSpeakingRecording,
  insertSpeakingRecording,
  listErrorEvents,
  listSpeakingRecordings,
} from '../SpeakingRepository';

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

  it('inserts and lists recordings', () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/docs/rec.m4a',
      durationMs: 3000,
      createdAt: NOW,
    });
    expect(listSpeakingRecordings()).toHaveLength(1);
  });

  it('deletes a recording by id', () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/docs/rec.m4a',
      durationMs: 3000,
      createdAt: NOW,
    });
    expect(deleteSpeakingRecording('rec-1')).toEqual({
      filePath: '/docs/rec.m4a',
    });
    expect(listSpeakingRecordings()).toHaveLength(0);
    expect(deleteSpeakingRecording('missing')).toBeNull();
  });
});

describe('SpeakingRepository error notebook', () => {
  beforeEach(() => setup());

  it('stores error events with a stable reviewItemId', () => {
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

  it('deletes recordings and error events', () => {
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

    const {deletedFilePaths} = clearSpeakingData();
    expect(deletedFilePaths).toEqual(['/docs/rec-1.m4a']);
    expect(listSpeakingRecordings()).toHaveLength(0);
    expect(listErrorEvents()).toHaveLength(0);
  });
});
