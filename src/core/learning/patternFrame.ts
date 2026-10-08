// COPY of the Server's `src/modules/items/model/patternFrame.ts` (keep both in sync).
/**
 * Pattern frames: `Can I have a {size} {drink}, please?`.
 *
 * Pure helpers shared by validation, the admin preview and (later) exercise
 * generation and grading. A slot name is `[a-z][a-z_]{0,23}`; any other brace
 * is malformed.
 */

export type FrameSegment =
  | {type: 'text'; value: string}
  | {type: 'slot'; name: string};

export type ParsedFrame =
  | {ok: true; segments: FrameSegment[]; slotNames: string[]}
  | {ok: false; reason: 'malformed_brace' | 'duplicate_slot'};

const SLOT_PATTERN = /\{([a-z][a-z_]{0,23})\}/g;

export function parseFrame(text: string): ParsedFrame {
  const segments: FrameSegment[] = [];
  const slotNames: string[] = [];
  let cursor = 0;
  for (const match of text.matchAll(SLOT_PATTERN)) {
    const index = match.index;
    const name = match[1]!;
    if (index > cursor) {
      segments.push({type: 'text', value: text.slice(cursor, index)});
    }
    if (slotNames.includes(name)) {
      return {ok: false, reason: 'duplicate_slot'};
    }
    slotNames.push(name);
    segments.push({type: 'slot', name});
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({type: 'text', value: text.slice(cursor)});
  }
  const strayBrace = segments.some(
    segment => segment.type === 'text' && /[{}]/.test(segment.value),
  );
  if (strayBrace) {
    return {ok: false, reason: 'malformed_brace'};
  }
  return {ok: true, segments, slotNames};
}

export type PatternSlot = {
  label_vi: string;
  values?: string[];
  item_refs?: string[];
};

/**
 * Concrete sentences of a frame, deterministic: slots vary like an odometer
 * (the last slot fastest) in their stored value order, cut at `limit`.
 * `resolveRef` maps an item code to its display text; unknown refs are skipped.
 */
export function expandPattern(
  text: string,
  slots: Record<string, PatternSlot>,
  resolveRef: (code: string) => string | null,
  limit: number,
): string[] {
  const parsed = parseFrame(text);
  if (!parsed.ok || limit <= 0) {
    return [];
  }
  const choices = parsed.slotNames.map(name => {
    const slot = slots[name];
    if (!slot) {
      return [];
    }
    const resolved = (slot.item_refs ?? [])
      .map(resolveRef)
      .filter((value): value is string => value !== null);
    return [...(slot.values ?? []), ...resolved];
  });
  if (choices.some(list => list.length === 0)) {
    return [];
  }

  const results: string[] = [];
  const indexes = choices.map(() => 0);
  while (results.length < limit) {
    let slotIndex = 0;
    results.push(
      parsed.segments
        .map(segment =>
          segment.type === 'text'
            ? segment.value
            : choices[slotIndex]![indexes[slotIndex++]!]!,
        )
        .join(''),
    );
    let position = indexes.length - 1;
    while (position >= 0) {
      indexes[position]! += 1;
      if (indexes[position]! < choices[position]!.length) {
        break;
      }
      indexes[position] = 0;
      position -= 1;
    }
    if (position < 0) {
      break;
    }
  }
  return results;
}

/**
 * App-only (not in the Server copy): the frame with each slot shown as its
 * label (`Can I have a … …, please?` without labels). A malformed frame is
 * returned unchanged.
 */
export function renderFrameWithLabels(
  text: string,
  labels: Record<string, string> = {},
): string {
  const parsed = parseFrame(text);
  if (!parsed.ok) {
    return text;
  }
  return parsed.segments
    .map(segment =>
      segment.type === 'text' ? segment.value : labels[segment.name] ?? '…',
    )
    .join('');
}
