import {getDatabase} from '@core/db/database';
import {
  ITEM_MEMORY_COLLECTION,
  ItemMemoryPayloadSchema,
  LESSON_OUTCOMES_COLLECTION,
  LessonOutcomePayloadSchema,
  MAX_REVIEW_STAGE,
  REVIEW_INTERVAL_DAYS,
  UNIT_OUTCOMES_COLLECTION,
  UnitOutcomePayloadSchema,
} from '@core/schemas/learningOutcomes';
import type {SyncPullRecord, SyncRecord} from '@core/schemas/sync';

/**
 * PR 16: local copies of the Server's read-only learning outcomes. Pulls
 * write them; the Server's row always wins. `item_memory` is also moved
 * ahead on the device right after a review (the same rule as the Server's
 * `itemMemory.ts`) so the due count drops at once.
 */

export const LEARNING_OUTCOME_COLLECTIONS = [
  LESSON_OUTCOMES_COLLECTION,
  UNIT_OUTCOMES_COLLECTION,
  ITEM_MEMORY_COLLECTION,
] as const;

export type LessonOutcome = {
  lessonId: string;
  practiceCompletedAt: string | null;
  passedAt: string | null;
  passedBy: 'service' | 'self' | 'rule' | null;
};

export type UnitOutcome = {
  unitId: string;
  summativeUnlockedAt: string | null;
  passedAt: string | null;
};

export type ItemMemory = {
  itemCode: string;
  stage: number;
  dueAt: string;
  stableAt: string | null;
  lastResult: 'correct' | 'incorrect' | null;
  lastReviewedAt: string | null;
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeLearningOutcomes(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function isLearningOutcomeCollection(collection: string): boolean {
  return (LEARNING_OUTCOME_COLLECTIONS as readonly string[]).includes(
    collection,
  );
}

/**
 * Pull applier for the three collections. A payload this build cannot read
 * is skipped; a tombstone (delete-my-data) removes the row.
 */
export function applyLearningOutcomeRecord(
  record: SyncRecord | SyncPullRecord,
): void {
  const db = getDatabase();
  const at = record.updated_at;
  if (record.collection === LESSON_OUTCOMES_COLLECTION) {
    if (record.tombstone) {
      db.execute('DELETE FROM lesson_outcomes WHERE lesson_id = ?;', [
        record.entity_id,
      ]);
    } else {
      const parsed = LessonOutcomePayloadSchema.safeParse(record.payload);
      if (!parsed.success) return;
      const row = parsed.data;
      db.execute(
        `INSERT OR REPLACE INTO lesson_outcomes (
          lesson_id, practice_completed_at, passed_at, passed_by, updated_at
        ) VALUES (?, ?, ?, ?, ?);`,
        [
          row.lesson_id,
          row.practice_completed_at,
          row.passed_at,
          row.passed_by,
          at,
        ],
      );
      if (row.practice_completed_at) {
        markLessonCompletedFromServer(row.lesson_id, row.practice_completed_at);
      }
    }
  } else if (record.collection === UNIT_OUTCOMES_COLLECTION) {
    if (record.tombstone) {
      db.execute('DELETE FROM unit_outcomes WHERE unit_id = ?;', [
        record.entity_id,
      ]);
    } else {
      const parsed = UnitOutcomePayloadSchema.safeParse(record.payload);
      if (!parsed.success) return;
      const row = parsed.data;
      db.execute(
        `INSERT OR REPLACE INTO unit_outcomes (
          unit_id, summative_unlocked_at, passed_at, updated_at
        ) VALUES (?, ?, ?, ?);`,
        [row.unit_id, row.summative_unlocked_at, row.passed_at, at],
      );
    }
  } else if (record.collection === ITEM_MEMORY_COLLECTION) {
    if (record.tombstone) {
      db.execute('DELETE FROM item_memory WHERE item_code = ?;', [
        record.entity_id,
      ]);
    } else {
      const parsed = ItemMemoryPayloadSchema.safeParse(record.payload);
      if (!parsed.success) return;
      writeItemMemory(
        {
          itemCode: parsed.data.item_code,
          stage: parsed.data.stage,
          dueAt: parsed.data.due_at,
          stableAt: parsed.data.stable_at,
          lastResult: parsed.data.last_result,
          lastReviewedAt: parsed.data.last_reviewed_at,
        },
        at,
      );
    }
  } else {
    return;
  }
  notify();
}

/**
 * Decision 2.7: practice finished on another device marks the lesson
 * complete here too. Only moves forward; nothing is queued, the Server
 * already knows.
 */
function markLessonCompletedFromServer(lessonId: string, at: string): void {
  const db = getDatabase();
  const existing = db
    .execute(
      'SELECT status FROM lesson_progress WHERE lesson_id = ? LIMIT 1;',
      [lessonId],
    )
    .rows?.item(0) as {status?: string} | undefined;
  if (existing?.status === 'completed') return;
  if (existing) {
    db.execute(
      `UPDATE lesson_progress
          SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE lesson_id = ?;`,
      [at, at, lessonId],
    );
    return;
  }
  db.execute(
    `INSERT INTO lesson_progress (
      lesson_id, status, started_at, completed_at, revision, tombstone,
      updated_at
    ) VALUES (?, 'completed', ?, ?, 0, 0, ?);`,
    [lessonId, at, at, at],
  );
}

type LessonOutcomeRow = {
  lesson_id: string;
  practice_completed_at: string | null;
  passed_at: string | null;
  passed_by: LessonOutcome['passedBy'];
};

export function getLessonOutcome(lessonId: string): LessonOutcome | null {
  const row = getDatabase()
    .execute('SELECT * FROM lesson_outcomes WHERE lesson_id = ? LIMIT 1;', [
      lessonId,
    ])
    .rows?.item(0) as LessonOutcomeRow | undefined;
  if (!row) return null;
  return {
    lessonId: row.lesson_id,
    practiceCompletedAt: row.practice_completed_at,
    passedAt: row.passed_at,
    passedBy: row.passed_by,
  };
}

/** Lesson ids the Server counts as passed. */
export function listPassedLessonIds(): Set<string> {
  const result = getDatabase().execute(
    'SELECT lesson_id FROM lesson_outcomes WHERE passed_at IS NOT NULL;',
  );
  const ids = new Set<string>();
  for (let i = 0; i < (result.rows?.length ?? 0); i += 1) {
    ids.add((result.rows!.item(i) as {lesson_id: string}).lesson_id);
  }
  return ids;
}

export function getUnitOutcome(unitId: string): UnitOutcome | null {
  const row = getDatabase()
    .execute('SELECT * FROM unit_outcomes WHERE unit_id = ? LIMIT 1;', [unitId])
    .rows?.item(0) as
    | {
        unit_id: string;
        summative_unlocked_at: string | null;
        passed_at: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    unitId: row.unit_id,
    summativeUnlockedAt: row.summative_unlocked_at,
    passedAt: row.passed_at,
  };
}

type ItemMemoryRow = {
  item_code: string;
  stage: number;
  due_at: string;
  stable_at: string | null;
  last_result: ItemMemory['lastResult'];
  last_reviewed_at: string | null;
};

function mapItemMemory(row: ItemMemoryRow): ItemMemory {
  return {
    itemCode: row.item_code,
    stage: row.stage,
    dueAt: row.due_at,
    stableAt: row.stable_at,
    lastResult: row.last_result,
    lastReviewedAt: row.last_reviewed_at,
  };
}

function writeItemMemory(memory: ItemMemory, at: string): void {
  getDatabase().execute(
    `INSERT OR REPLACE INTO item_memory (
      item_code, stage, due_at, stable_at, last_result, last_reviewed_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      memory.itemCode,
      memory.stage,
      memory.dueAt,
      memory.stableAt,
      memory.lastResult,
      memory.lastReviewedAt,
      at,
    ],
  );
}

export function getItemMemory(itemCode: string): ItemMemory | null {
  const row = getDatabase()
    .execute('SELECT * FROM item_memory WHERE item_code = ? LIMIT 1;', [
      itemCode,
    ])
    .rows?.item(0) as ItemMemoryRow | undefined;
  return row ? mapItemMemory(row) : null;
}

/** Items due at `now`, the longest overdue first (decision B8). */
export function listDueItemMemory(now: string, limit?: number): ItemMemory[] {
  const result = getDatabase().execute(
    `SELECT * FROM item_memory WHERE due_at <= ?
      ORDER BY due_at ASC, item_code ASC${limit != null ? ' LIMIT ?' : ''};`,
    limit != null ? [now, limit] : [now],
  );
  const out: ItemMemory[] = [];
  for (let i = 0; i < (result.rows?.length ?? 0); i += 1) {
    out.push(mapItemMemory(result.rows!.item(i) as ItemMemoryRow));
  }
  return out;
}

/** Every item code with a review schedule (decision G10). */
export function listScheduledItemCodes(): Set<string> {
  const result = getDatabase().execute('SELECT item_code FROM item_memory;');
  const codes = new Set<string>();
  for (let i = 0; i < (result.rows?.length ?? 0); i += 1) {
    codes.add((result.rows!.item(i) as {item_code: string}).item_code);
  }
  return codes;
}

const DAY_MS = 86_400_000;

/**
 * The Server's `nextMemory` for one review that came due: one stage up when
 * right, one down when wrong, never back to the start; null before the due
 * time. The local copy has no streak, so it never sets `stable_at` itself:
 * the next pull brings it.
 */
export function nextItemMemory(
  memory: ItemMemory,
  result: 'correct' | 'incorrect',
  at: Date,
): ItemMemory | null {
  if (at.getTime() < Date.parse(memory.dueAt)) return null;
  const stage =
    result === 'correct'
      ? Math.min(MAX_REVIEW_STAGE, memory.stage + 1)
      : Math.max(0, memory.stage - 1);
  return {
    itemCode: memory.itemCode,
    stage,
    dueAt: new Date(
      at.getTime() + REVIEW_INTERVAL_DAYS[stage]! * DAY_MS,
    ).toISOString(),
    stableAt: memory.stableAt,
    lastResult: result,
    lastReviewedAt: at.toISOString(),
  };
}

/** Move one item ahead on the device after a review (decision G9). */
export function applyLocalItemReview(
  itemCode: string,
  result: 'correct' | 'incorrect',
  at: Date = new Date(),
): ItemMemory | null {
  const memory = getItemMemory(itemCode);
  if (!memory) return null;
  const next = nextItemMemory(memory, result, at);
  if (!next) return null;
  writeItemMemory(next, at.toISOString());
  notify();
  return next;
}
