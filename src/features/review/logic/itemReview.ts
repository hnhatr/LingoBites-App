import {getDatabase} from '@core/db/database';
import {type CatalogItem, CatalogItemSchema} from '@core/schemas/lesson';
import {recordActivityAttempt} from '@core/sync/activityAttempts';
import {
  applyLocalItemReview,
  type ItemMemory,
  listDueItemMemory,
} from '@core/sync/learningOutcomes';

/**
 * PR 16: review of lesson items on the Server's schedule (`item_memory`,
 * decisions B7–B8, G7–G9). Each answer is a `kind = review` attempt keyed
 * by the item code; the Server moves the schedule, the device moves its
 * copy ahead until the next pull.
 */

/** Decision B8: at most 20 items a day, the rest wait for tomorrow. */
export const DAILY_ITEM_REVIEW_LIMIT = 20;
export const ITEM_REVIEW_ACTIVITY = 'item_recall';

const DAY_MS = 86_400_000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Midnight in Vietnam (UTC+7), as the Server counts days. */
export function startOfVietnamDay(now: Date): Date {
  const shifted = now.getTime() + VIETNAM_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - VIETNAM_OFFSET_MS);
}

/** Item reviews answered since midnight in Vietnam. */
export function itemReviewsDoneToday(now: Date = new Date()): number {
  const row = getDatabase()
    .execute(
      `SELECT COUNT(*) AS n FROM activity_attempts
        WHERE kind = 'review' AND activity = ? AND occurred_at >= ?
          AND tombstone = 0;`,
      [ITEM_REVIEW_ACTIVITY, startOfVietnamDay(now).toISOString()],
    )
    .rows?.item(0) as {n?: number} | undefined;
  return row?.n ?? 0;
}

/**
 * What an item says and means, from the downloaded lessons that teach it
 * (decision G7). The newest download wins when two lessons carry it.
 */
export function itemContents(
  codes: readonly string[],
): Map<string, CatalogItem> {
  const found = new Map<string, CatalogItem>();
  if (codes.length === 0) return found;
  const wanted = new Set(codes);
  const result = getDatabase().execute(
    `SELECT json_extract(entry.value, '$.item') AS item_json
       FROM lesson_downloads AS d,
            json_each(d.snapshot_json, '$.lesson.lesson_items') AS entry
      WHERE json_extract(entry.value, '$.item.code') IN (${codes
        .map(() => '?')
        .join(', ')})
      ORDER BY d.downloaded_at DESC;`,
    [...wanted],
  );
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows!.item(index) as {item_json: string};
    try {
      const parsed = CatalogItemSchema.safeParse(JSON.parse(row.item_json));
      if (parsed.success && !found.has(parsed.data.code)) {
        found.set(parsed.data.code, parsed.data);
      }
    } catch {
      // A broken row only hides that item.
    }
  }
  return found;
}

export type DueItem = {memory: ItemMemory; item: CatalogItem};

export type ItemReviewQueue = {
  /** Today's items, the longest overdue first, within the daily limit. */
  items: DueItem[];
  /** Due items whose lesson is no longer on the device. */
  missing: number;
  /** Item reviews already answered today. */
  doneToday: number;
};

export function itemReviewQueue(now: Date = new Date()): ItemReviewQueue {
  const doneToday = itemReviewsDoneToday(now);
  const budget = Math.max(0, DAILY_ITEM_REVIEW_LIMIT - doneToday);
  const due = listDueItemMemory(now.toISOString());
  const contents = itemContents(due.map(memory => memory.itemCode));
  const ready = due.flatMap(memory => {
    const item = contents.get(memory.itemCode);
    return item ? [{memory, item}] : [];
  });
  return {
    items: ready.slice(0, budget),
    missing: due.length - ready.length,
    doneToday,
  };
}

/** Today's item review count for Today and the review entry. */
export function countItemsForReview(now: Date = new Date()): number {
  try {
    return itemReviewQueue(now).items.length;
  } catch {
    return 0;
  }
}

/** Due items among some item codes (a lesson's step 1). */
export function dueItemCodes(
  codes: readonly string[],
  now: Date = new Date(),
): Set<string> {
  const wanted = new Set(codes);
  return new Set(
    listDueItemMemory(now.toISOString())
      .map(memory => memory.itemCode)
      .filter(code => wanted.has(code)),
  );
}

export type RecordItemReviewInput = {
  itemCode: string;
  result: 'correct' | 'incorrect';
  durationMs: number;
  sessionId?: string | null;
  now?: Date;
};

/** One answer: queued for the Server and applied to the local schedule. */
export function recordItemReview(input: RecordItemReviewInput): boolean {
  const at = input.now ?? new Date();
  const recorded = recordActivityAttempt({
    kind: 'review',
    activity: ITEM_REVIEW_ACTIVITY,
    itemKey: input.itemCode,
    sessionId: input.sessionId ?? null,
    result: input.result,
    durationMs: input.durationMs,
    occurredAt: at.toISOString(),
  });
  if (!recorded.ok) return false;
  try {
    applyLocalItemReview(input.itemCode, input.result, at);
  } catch {
    // The Server's row comes with the next pull.
  }
  return true;
}
