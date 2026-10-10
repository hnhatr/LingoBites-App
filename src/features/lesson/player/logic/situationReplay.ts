import type {LessonPatternEntry} from './lessonHubContent';

/**
 * E5 (S3): "luyện nói lại tình huống". The same sentence frame with ONE detail
 * changed (another drink, another time). The change is picked from the lesson's
 * own stored values with a seed of lesson + day, so it is stable for a day and
 * differs between days. No AI call, nothing stored.
 */
export type ReplayLine = {
  before: string;
  after: string;
  changedLabelVi: string;
};

/** Local calendar day as `YYYY-MM-DD`: the seed changes at midnight. */
export function replayDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 32-bit FNV-1a: small, stable across runs, no dependency. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

function render(
  entry: LessonPatternEntry,
  choiceFor: (slotName: string, choices: string[]) => string,
): string {
  return entry.segments
    .map(segment => {
      if (segment.type === 'text') return segment.value;
      const slot = entry.slots.find(
        candidate => candidate.name === segment.name,
      );
      return slot ? choiceFor(slot.name, slot.choices) : '';
    })
    .join('');
}

/**
 * The first sentence pattern with a slot that has another value to try, or
 * null when no pattern has one. The changed value never equals the default.
 */
export function replayLine(
  entries: LessonPatternEntry[],
  dayKey: string,
): ReplayLine | null {
  for (const entry of entries) {
    const changeable = entry.slots.filter(slot => slot.choices.length > 1);
    if (changeable.length === 0) continue;
    const seed = hash(`${entry.key}|${dayKey}`);
    const slot = changeable[seed % changeable.length]!;
    const pick =
      1 + (Math.floor(seed / changeable.length) % (slot.choices.length - 1));
    const before = render(entry, (_name, choices) => choices[0]!);
    const after = render(entry, (name, choices) =>
      name === slot.name ? choices[pick]! : choices[0]!,
    );
    return {before, after, changedLabelVi: slot.labelVi};
  }
  return null;
}
