import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  ActivityAttemptPayloadSchema,
  SyncCollectionSchema,
} from '@core/schemas/sync';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {listActivityAttempts, recordActivityAttempt} from '../activityAttempts';

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

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  getDatabase();
});

describe('activity attempts', () => {
  it('is an allowlisted sync collection', () => {
    expect(SyncCollectionSchema.safeParse('activity_attempts').success).toBe(
      true,
    );
  });

  it('writes the row and its outbox event together, with an id-only payload', () => {
    const result = recordActivityAttempt({
      kind: 'practice',
      activity: 'meaning_choice',
      lessonId: LESSON,
      itemKey: 'word:coffee',
      result: 'correct',
      durationMs: 2300.4,
      occurredAt: '2026-10-06T10:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(listActivityAttempts(LESSON)).toEqual([
      {
        id: result.id,
        kind: 'practice',
        activity: 'meaning_choice',
        lessonId: LESSON,
        itemKey: 'word:coffee',
        sessionId: null,
        result: 'correct',
        score: null,
        durationMs: 2300,
        occurredAt: '2026-10-06T10:00:00.000Z',
      },
    ]);

    const outbox = rows('SELECT * FROM sync_outbox;');
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.event_type).toBe('activity_attempts');
    expect(outbox[0]!.entity_id).toBe(result.id);
    const payload = JSON.parse(outbox[0]!.payload_json);
    expect(ActivityAttemptPayloadSchema.safeParse(payload).success).toBe(true);
    expect(Object.keys(payload).sort()).toEqual([
      'activity',
      'duration_ms',
      'item_key',
      'kind',
      'lesson_id',
      'result',
      'score',
      'session_id',
    ]);
  });

  it('refuses an attempt the Server would reject and writes nothing', () => {
    for (const bad of [
      {activity: 'Meaning Choice'},
      {lessonId: 'not-a-uuid'},
      {durationMs: -5},
      {score: 2},
      {itemKey: '   '},
    ]) {
      const result = recordActivityAttempt({
        kind: 'game',
        activity: 'word_match',
        result: 'incorrect',
        durationMs: 100,
        ...bad,
      });
      expect(result).toEqual({ok: false, errorCode: 'INVALID_ATTEMPT'});
    }
    expect(rows('SELECT * FROM activity_attempts;')).toHaveLength(0);
    expect(rows('SELECT * FROM sync_outbox;')).toHaveLength(0);
  });

  it('is idempotent per attempt id at the table level', () => {
    const input = {
      kind: 'review' as const,
      activity: 'flashcard',
      result: 'correct' as const,
      durationMs: 10,
      id: 'attempt-1',
    };
    expect(recordActivityAttempt(input)).toEqual({ok: true, id: 'attempt-1'});
    expect(recordActivityAttempt(input)).toEqual({
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
    });
    expect(rows('SELECT * FROM activity_attempts;')).toHaveLength(1);
    expect(rows('SELECT * FROM sync_outbox;')).toHaveLength(1);
  });
});
