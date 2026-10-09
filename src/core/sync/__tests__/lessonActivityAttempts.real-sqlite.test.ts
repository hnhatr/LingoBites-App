import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {LessonActivityAttemptPayloadSchema} from '@core/schemas/sync';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  listLessonActivityAttempts,
  recordLessonActivityAttempt,
  type RecordLessonActivityAttemptInput,
} from '../activityAttempts';

const LESSON = '33333333-3333-4333-8333-333333333301';
const BLOCK = '44444444-4444-4444-8444-444444444403';

const input: RecordLessonActivityAttemptInput = {
  activity: 'speaking_drill',
  lessonId: LESSON,
  blockId: BLOCK,
  contentRevision: 3,
  step: 3,
  taskId: null,
  itemKeys: ['pattern:can-i-have', 'word:coffee'],
  sessionId: '55555555-5555-4555-8555-555555555501',
  supportLevel: 'none',
  outcome: 'pass_with_support',
  assessedBy: 'self',
  durationMs: 8400.2,
  occurredAt: '2026-10-08T06:10:00.000Z',
};

function outbox(): Array<Record<string, unknown>> {
  const result = getDatabase().execute(
    'SELECT event_type, entity_id, payload_json FROM sync_outbox;',
  ).rows;
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) {
    out.push(result!.item(i) as Record<string, unknown>);
  }
  return out;
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  getDatabase();
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('lesson activity attempts (PR 10)', () => {
  it('writes the row and a Server-valid outbox payload together', () => {
    const result = recordLessonActivityAttempt(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(listLessonActivityAttempts(LESSON)).toEqual([
      {
        id: result.id,
        activity: 'speaking_drill',
        blockId: BLOCK,
        contentRevision: 3,
        step: 3,
        outcome: 'pass_with_support',
        supportLevel: 'none',
        occurredAt: '2026-10-08T06:10:00.000Z',
      },
    ]);
    const events = outbox();
    expect(events).toHaveLength(1);
    expect(events[0]!.event_type).toBe('activity_attempts');
    expect(events[0]!.entity_id).toBe(result.id);
    const payload = JSON.parse(String(events[0]!.payload_json));
    expect(LessonActivityAttemptPayloadSchema.parse(payload)).toEqual({
      kind: 'lesson',
      activity: 'speaking_drill',
      lesson_id: LESSON,
      block_id: BLOCK,
      content_revision: 3,
      step: 3,
      task_id: null,
      item_keys: ['pattern:can-i-have', 'word:coffee'],
      session_id: '55555555-5555-4555-8555-555555555501',
      support_level: 'none',
      outcome: 'pass_with_support',
      assessed_by: 'self',
      duration_ms: 8400,
    });
  });

  it('refuses a payload the Server would reject and writes nothing', () => {
    expect(
      recordLessonActivityAttempt({...input, itemKeys: ['coffee']}),
    ).toEqual({ok: false, errorCode: 'INVALID_ATTEMPT'});
    expect(
      recordLessonActivityAttempt({
        ...input,
        supportLevel: 'hint_1',
        outcome: 'pass_independent',
      }),
    ).toEqual({ok: false, errorCode: 'INVALID_ATTEMPT'});
    expect(listLessonActivityAttempts(LESSON)).toEqual([]);
    expect(outbox()).toEqual([]);
  });
});
