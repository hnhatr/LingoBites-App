import fs from 'node:fs';
import path from 'node:path';

import {
  LessonProgressPushPayloadSchema,
  LessonProgressStatePayloadSchema,
  SYNC_CONTRACT_VERSION,
  SyncPullSuccessResponseSchema,
  SyncPushRequestSchema,
} from '../sync';

/**
 * LING-172 (TASK-006): the App sync mirror matches the Server contract at
 * Server `integration/LING-149` @ `02890ed5` (AD-009). The fixtures below
 * are byte-identical copies of the Server canonical fixtures
 * (`src/modules/canonicalLesson/model/fixtures/
 * valid-sync-lesson-progress-{push-request,pull-response}.json`); this test
 * fails if either side drifts.
 */
function loadFixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'),
  );
}

describe('sync lesson_progress contract mirror (Server integration/LING-149)', () => {
  it('uses sync contract version 2', () => {
    expect(SYNC_CONTRACT_VERSION).toBe(2);
  });

  it('parses the canonical push-request fixture', () => {
    const parsed = SyncPushRequestSchema.safeParse(
      loadFixture('valid-sync-lesson-progress-push-request.json'),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mutations).toHaveLength(1);
      const [mutation] = parsed.data.mutations;
      expect(mutation.collection).toBe('lesson_progress');
      expect(mutation.tombstone).toBe(false);
      expect(
        LessonProgressPushPayloadSchema.safeParse(mutation.payload).success,
      ).toBe(true);
    }
  });

  it('parses the canonical pull-response fixture', () => {
    const parsed = SyncPullSuccessResponseSchema.safeParse(
      loadFixture('valid-sync-lesson-progress-pull-response.json'),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contract_version).toBe(2);
      expect(parsed.data.records).toHaveLength(1);
      const [record] = parsed.data.records;
      expect(record.collection).toBe('lesson_progress');
      expect(record.tombstone).toBe(false);
      expect(
        LessonProgressStatePayloadSchema.safeParse(record.payload).success,
      ).toBe(true);
    }
  });
});
