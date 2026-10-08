// COPY of the Server's `src/modules/items/model/itemPayload.ts` (keep both in sync).
import {z} from 'zod';

import {
  ITEM_REFS_MAX,
  ITEM_SHORT_TEXT_MAX,
  type ItemKind,
  MINIMAL_PAIRS_MAX,
  PATTERN_SLOT_VALUES_MAX,
  PATTERN_SLOTS_MAX,
} from './catalogItem';
import {parseItemCode} from './itemCode';
import {parseFrame} from './patternFrame';

/**
 * Kind-specific `items.payload`. Every `*item_refs` entry is another item's
 * `code`; whether that item exists and may be referenced is checked by the
 * service against the database.
 */

const shortText = z.string().trim().min(1).max(ITEM_SHORT_TEXT_MAX);

const ItemRefSchema = z
  .string()
  .trim()
  .refine(code => parseItemCode(code) !== null, {
    message: 'must be an item code (<kind>:<body>)',
  });

const ItemRefListSchema = z.array(ItemRefSchema).max(ITEM_REFS_MAX);

export const EmptyPayloadSchema = z.object({}).strict();

export const PatternSlotSchema = z
  .object({
    label_vi: shortText,
    values: z.array(shortText).max(PATTERN_SLOT_VALUES_MAX).optional(),
    item_refs: z.array(ItemRefSchema).max(PATTERN_SLOT_VALUES_MAX).optional(),
  })
  .strict()
  .refine(
    slot =>
      (slot.values?.length ?? 0) + (slot.item_refs?.length ?? 0) > 0 &&
      (slot.values?.length ?? 0) + (slot.item_refs?.length ?? 0) <=
        PATTERN_SLOT_VALUES_MAX,
    {
      message: `a slot needs 1–${PATTERN_SLOT_VALUES_MAX} values or item_refs`,
    },
  );

export const PatternPayloadSchema = z
  .object({
    slots: z
      .record(z.string().regex(/^[a-z][a-z_]{0,23}$/), PatternSlotSchema)
      .refine(
        slots =>
          Object.keys(slots).length >= 1 &&
          Object.keys(slots).length <= PATTERN_SLOTS_MAX,
        {message: `a pattern needs 1–${PATTERN_SLOTS_MAX} slots`},
      ),
  })
  .strict();

export const PronunciationPayloadSchema = z
  .object({
    focus: shortText,
    focus_ipa: shortText.optional(),
    tip_vi: shortText,
    minimal_pairs: z
      .array(z.tuple([shortText, shortText]))
      .max(MINIMAL_PAIRS_MAX)
      .default([]),
    target_item_refs: ItemRefListSchema.optional(),
  })
  .strict();

export const ListeningPayloadSchema = z
  .object({
    question_en: shortText,
    question_vi: shortText.optional(),
    audio_media_id: z.string().uuid().optional(),
    answer_text: shortText.optional(),
    answer_item_refs: ItemRefListSchema.optional(),
  })
  .strict()
  .refine(
    payload =>
      payload.answer_text !== undefined ||
      (payload.answer_item_refs?.length ?? 0) > 0,
    {message: 'a listening item needs answer_text or answer_item_refs'},
  );

export type PatternPayload = z.infer<typeof PatternPayloadSchema>;
export type PronunciationPayload = z.infer<typeof PronunciationPayloadSchema>;
export type ListeningPayload = z.infer<typeof ListeningPayloadSchema>;
export type ItemPayload =
  | Record<string, never>
  | PatternPayload
  | PronunciationPayload
  | ListeningPayload;

export type PayloadIssue = {path: string; message: string};

export type ParsedPayload =
  | {ok: true; payload: ItemPayload}
  | {ok: false; issues: PayloadIssue[]};

const payloadSchemaByKind = {
  word: EmptyPayloadSchema,
  phrase: EmptyPayloadSchema,
  pattern: PatternPayloadSchema,
  pronunciation: PronunciationPayloadSchema,
  listening: ListeningPayloadSchema,
} as const;

function fail(path: string, message: string): ParsedPayload {
  return {ok: false, issues: [{path, message}]};
}

/**
 * Validates `payload` for `kind` together with the item's `text`, which is the
 * frame for a pattern and must (not) contain a space for a phrase (word).
 */
export function parseItemPayload(
  kind: ItemKind,
  text: string,
  payload: unknown,
): ParsedPayload {
  const parsed = payloadSchemaByKind[kind].safeParse(payload ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(issue => ({
        path: ['payload', ...issue.path].join('.'),
        message: issue.message,
      })),
    };
  }

  const hasSpace = /\s/.test(text.trim());
  if (kind === 'word' && hasSpace) {
    return fail('text', 'a word must not contain spaces (use kind phrase)');
  }
  if (kind === 'phrase' && !hasSpace) {
    return fail('text', 'a phrase must contain a space (use kind word)');
  }
  if (kind !== 'pattern' && /[{}]/.test(text)) {
    return fail('text', 'only a pattern may contain {slot} placeholders');
  }

  if (kind === 'pattern') {
    const frame = parseFrame(text);
    if (!frame.ok) {
      return fail(
        'text',
        frame.reason === 'duplicate_slot'
          ? 'a slot may appear only once in the frame'
          : 'the frame has a brace that is not a {slot}',
      );
    }
    const slots = Object.keys((parsed.data as PatternPayload).slots).sort();
    const named = [...frame.slotNames].sort();
    if (slots.join(',') !== named.join(',')) {
      return fail(
        'payload.slots',
        `slots must match the frame placeholders exactly (${
          named.join(', ') || 'none'
        })`,
      );
    }
  }

  return {ok: true, payload: parsed.data as ItemPayload};
}

export type PayloadItemRef = {
  code: string;
  /** `slot` refs must point at a word or phrase. */
  role: 'slot' | 'target' | 'answer';
};

/** Every item code a validated payload references, in payload order. */
export function payloadItemRefs(
  kind: ItemKind,
  payload: ItemPayload,
): PayloadItemRef[] {
  if (kind === 'pattern') {
    return Object.values((payload as PatternPayload).slots).flatMap(slot =>
      (slot.item_refs ?? []).map(code => ({code, role: 'slot' as const})),
    );
  }
  if (kind === 'pronunciation') {
    return ((payload as PronunciationPayload).target_item_refs ?? []).map(
      code => ({code, role: 'target' as const}),
    );
  }
  if (kind === 'listening') {
    return ((payload as ListeningPayload).answer_item_refs ?? []).map(code => ({
      code,
      role: 'answer' as const,
    }));
  }
  return [];
}

/** Media ids a validated payload links (only listening carries one). */
export function payloadMediaIds(
  kind: ItemKind,
  payload: ItemPayload,
): string[] {
  if (kind === 'listening') {
    const id = (payload as ListeningPayload).audio_media_id;
    return id ? [id] : [];
  }
  return [];
}

/**
 * A variant may reuse the frame's `{slot}`s (any subset); for every other kind
 * it must be plain text.
 */
export function variantSlotProblem(
  kind: ItemKind,
  frameText: string,
  variantText: string,
): string | null {
  if (kind !== 'pattern') {
    return /[{}]/.test(variantText)
      ? 'only a pattern variant may contain {slot} placeholders'
      : null;
  }
  const variant = parseFrame(variantText);
  if (!variant.ok) {
    return 'the variant has a malformed or repeated {slot}';
  }
  const frame = parseFrame(frameText);
  const allowed = new Set(frame.ok ? frame.slotNames : []);
  const unknown = variant.slotNames.filter(name => !allowed.has(name));
  return unknown.length > 0
    ? `the variant uses slots the frame does not have: ${unknown.join(', ')}`
    : null;
}
