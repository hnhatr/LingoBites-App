import {readFileSync} from 'fs';
import {join} from 'path';

import {EvaluationPayloadSchema} from '../evaluation';
import {
  LessonActivityAttemptPayloadSchema,
  SyncPullSuccessResponseSchema,
  SyncPushRequestSchema,
} from '../sync';

/** PR 14: the app reads the Server's PR 12 fixtures with its own schemas. */
function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', name), 'utf8'),
  ) as unknown;
}

it('parses the pending attempts the app sends for grading', () => {
  const request = SyncPushRequestSchema.parse(
    fixture('valid-sync-activity-attempt-lesson-pending-push-request.json'),
  );
  for (const mutation of request.mutations) {
    const payload = LessonActivityAttemptPayloadSchema.parse(mutation.payload);
    expect(payload.outcome).toBe('pending');
    expect(payload.assessed_by).toBe('service');
  }
});

it('rejects a pending attempt that is not service-assessed, and the reverse', () => {
  const request = fixture(
    'valid-sync-activity-attempt-lesson-pending-push-request.json',
  ) as {mutations: Array<{payload: Record<string, unknown>}>};
  const base = request.mutations[1]!.payload;
  expect(
    LessonActivityAttemptPayloadSchema.safeParse({...base, assessed_by: 'self'})
      .success,
  ).toBe(false);
  expect(
    LessonActivityAttemptPayloadSchema.safeParse({
      ...base,
      outcome: 'pass_independent',
    }).success,
  ).toBe(false);
});

it('parses pulled evaluation records', () => {
  const response = SyncPullSuccessResponseSchema.parse(
    fixture('valid-sync-evaluation-pull-response.json'),
  );
  expect(response.records.map(record => record.collection)).toEqual([
    'evaluations',
    'evaluations',
  ]);
  for (const record of response.records) {
    expect(EvaluationPayloadSchema.parse(record.payload).attempt_id).toBe(
      record.entity_id,
    );
  }
});
