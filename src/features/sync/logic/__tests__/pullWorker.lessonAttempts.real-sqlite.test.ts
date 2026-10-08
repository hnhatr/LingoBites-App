import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {listLessonActivityAttempts} from '@core/sync/activityAttempts';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {applySyncRecord} from '../pullWorker';

const T1 = '2026-10-08T10:00:00.000Z';
const LESSON = '33333333-3333-4333-8333-333333333301';

let db: RealSqliteConnection;

beforeEach(() => {
  db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  db.close();
  resetDatabaseForTests(null);
});

describe('pullWorker lesson attempts (schema v8)', () => {
  it('stores an attempt made on another device without a result', () => {
    expect(() =>
      applySyncRecord({
        collection: 'activity_attempts',
        entity_id: '99999999-9999-4999-8999-999999999902',
        payload: {
          kind: 'lesson',
          activity: 'fill_blank',
          lesson_id: LESSON,
          block_id: '44444444-4444-4444-8444-444444444404',
          content_revision: 3,
          step: 3,
          task_id: null,
          item_keys: ['pattern:can-i-have'],
          session_id: null,
          support_level: 'none',
          outcome: 'pass_independent',
          assessed_by: 'rule',
          duration_ms: 3100,
        },
        revision: 4,
        occurred_at: T1,
        updated_at: T1,
        tombstone: false,
      }),
    ).not.toThrow();

    expect(listLessonActivityAttempts(LESSON)).toEqual([
      {
        id: '99999999-9999-4999-8999-999999999902',
        activity: 'fill_blank',
        blockId: '44444444-4444-4444-8444-444444444404',
        contentRevision: 3,
        step: 3,
        outcome: 'pass_independent',
        supportLevel: 'none',
        occurredAt: T1,
      },
    ]);
    const row = db.execute(
      'SELECT result, item_keys_json, revision FROM activity_attempts;',
    ).rows?._array?.[0];
    expect(row).toEqual({
      result: null,
      item_keys_json: '["pattern:can-i-have"]',
      revision: 4,
    });
  });
});
