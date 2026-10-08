import {
  acceptedAnswers,
  normalizeAnswer,
  parseFrame,
  parseItemPayload,
  type PatternPayload,
} from '@core/learning';
import {
  type ActivityContent,
  type ActivityKind,
  isActivityKind,
  parseActivityContent,
} from '@core/schemas/activityContent';
import type {
  CatalogItem,
  LessonBlock,
  LessonSnapshot,
  LessonTask,
} from '@core/schemas/lesson';
import {LESSON_ATTEMPT_ITEM_KEYS_MAX} from '@core/schemas/sync';

/**
 * Reading a curriculum lesson for the six-step player: the lesson's items by
 * id, the activity content of a block, the catalog codes it practises and the
 * answers a pattern accepts. Everything comes from the downloaded snapshot,
 * so the player works offline.
 */

export type FlowItems = ReadonlyMap<string, CatalogItem>;

export function flowItems(snapshot: LessonSnapshot): FlowItems {
  return new Map(
    (snapshot.lesson_items ?? []).map(entry => [entry.item.id, entry.item]),
  );
}

export type FlowActivity = {
  kind: ActivityKind;
  /** `null` when the block has no valid content for its kind. */
  content: ActivityContent | null;
  titleVi: string;
  instructionsVi: string | null;
  taskId: string | null;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** The activity a block holds, or `null` for other blocks and unknown kinds. */
export function flowActivity(block: LessonBlock): FlowActivity | null {
  if (block.type !== 'activity') return null;
  const kind = block.data.activityKind;
  if (!isActivityKind(kind)) return null;
  return {
    kind,
    content: parseActivityContent(kind, block.data.content),
    titleVi: text(block.data.titleVi) ?? '',
    instructionsVi: text(block.data.instructionsVi),
    taskId: text(block.data.task_id),
  };
}

export function flowTask(
  snapshot: LessonSnapshot,
  taskId: string | null,
): LessonTask | null {
  if (!taskId) return null;
  return (snapshot.tasks ?? []).find(task => task.id === taskId) ?? null;
}

function idsInContent(value: unknown, into: string[]): void {
  if (Array.isArray(value)) {
    value.forEach(entry => idsInContent(entry, into));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, field] of Object.entries(value)) {
    if (
      (key === 'itemId' || key === 'patternItemId') &&
      typeof field === 'string'
    ) {
      into.push(field);
    } else {
      idsInContent(field, into);
    }
  }
}

/**
 * Catalog codes an activity block practises (its `item_refs` and the items
 * its content names), for the attempt's `item_keys`. Ids the lesson does not
 * carry are skipped; at most 20, like the Server allows.
 */
export function blockItemKeys(block: LessonBlock, items: FlowItems): string[] {
  const ids: string[] = [];
  const refs = block.data.item_refs;
  if (Array.isArray(refs)) {
    refs.forEach(ref => {
      if (typeof ref === 'string') ids.push(ref);
    });
  }
  idsInContent(block.data.content, ids);
  const codes: string[] = [];
  for (const id of ids) {
    const code = items.get(id)?.code;
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes.slice(0, LESSON_ATTEMPT_ITEM_KEYS_MAX);
}

type Pattern = {
  item: CatalogItem;
  frame: {text: string; payload: PatternPayload};
};

export function flowPattern(
  items: FlowItems,
  patternItemId: string | undefined,
): Pattern | null {
  const item = patternItemId ? items.get(patternItemId) : undefined;
  if (!item || item.kind !== 'pattern' || !parseFrame(item.text).ok) {
    return null;
  }
  const parsed = parseItemPayload('pattern', item.text, item.payload);
  if (!parsed.ok) return null;
  return {
    item,
    frame: {text: item.text, payload: parsed.payload as PatternPayload},
  };
}

function resolverFor(items: FlowItems) {
  const byCode = new Map(
    [...items.values()].map(item => [item.code, item.text]),
  );
  return (code: string) => byCode.get(code) ?? null;
}

/**
 * Answers accepted for a sentence (decision G9): the model sentence itself
 * plus, with a pattern, every sentence of its frame and variants.
 */
export function acceptedFor(
  items: FlowItems,
  model: string,
  patternItemId?: string,
): string[] {
  const pattern = flowPattern(items, patternItemId);
  const fromPattern = pattern
    ? acceptedAnswers(pattern.frame, pattern.item.variants, resolverFor(items))
    : [];
  const own = normalizeAnswer(model);
  return own && !fromPattern.includes(own)
    ? [own, ...fromPattern]
    : fromPattern;
}

/** True when the typed answer is one of the accepted ones. */
export function isAccepted(
  answer: string,
  accepted: readonly string[],
): boolean {
  const key = normalizeAnswer(answer);
  return key.length > 0 && accepted.includes(key);
}

/** The sentence a drill combination asks for (the frame filled in). */
export function comboSentence(
  items: FlowItems,
  patternItemId: string,
  values: Readonly<Record<string, string>>,
): string {
  const pattern = flowPattern(items, patternItemId);
  return pattern
    ? fillFrame(pattern.item.text, values)
    : Object.values(values).join(' ');
}

/** A frame with values filled in; a missing value stays as `…`. */
export function fillFrame(
  frame: string,
  values: Readonly<Record<string, string>>,
): string {
  const parsed = parseFrame(frame);
  if (!parsed.ok) return frame;
  return parsed.segments
    .map(segment =>
      segment.type === 'text' ? segment.value : values[segment.name] ?? '…',
    )
    .join('');
}
