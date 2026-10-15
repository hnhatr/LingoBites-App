import type {LocalComboSetSummary} from './comboSetRepository';

export type ComboHistoryGroupKey = 'today' | 'week' | 'earlier';

export type ComboHistoryGroup = {
  key: ComboHistoryGroupKey;
  sets: LocalComboSetSummary[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "word:december" → "december": the word a set was made for. */
export function comboWordLabel(itemCode: string): string {
  return itemCode.slice(itemCode.indexOf(':') + 1).trim();
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** Which history group a set opened at `createdAt` falls in, seen at `now`. */
export function comboHistoryGroupOf(
  createdAt: string,
  now: Date,
): ComboHistoryGroupKey {
  const opened = new Date(createdAt).getTime();
  if (Number.isNaN(opened)) return 'earlier';
  const today = startOfDay(now);
  if (opened >= today) return 'today';
  // The week starts on Monday, as on Vietnamese calendars.
  const weekStart = today - ((now.getDay() + 6) % 7) * DAY_MS;
  if (opened >= weekStart) return 'week';
  return 'earlier';
}

/** Groups sets (already newest first) into today, this week and earlier. */
export function groupComboHistory(
  sets: readonly LocalComboSetSummary[],
  now: Date,
): ComboHistoryGroup[] {
  const groups: ComboHistoryGroup[] = [];
  for (const set of sets) {
    const key = comboHistoryGroupOf(set.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.sets.push(set);
    } else {
      groups.push({key, sets: [set]});
    }
  }
  return groups;
}

/** The chip under a card: the time today, else the day and month. */
export function comboOpenedLabel(createdAt: string, now: Date): string {
  const opened = new Date(createdAt);
  if (Number.isNaN(opened.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  if (comboHistoryGroupOf(createdAt, now) === 'today') {
    return `${pad(opened.getHours())}:${pad(opened.getMinutes())}`;
  }
  return `${pad(opened.getDate())}/${pad(opened.getMonth() + 1)}`;
}

/**
 * Splits a sentence around the set's word so the card can colour it:
 * "My birthday is in December." → ["My birthday is in ", "December", "."].
 * Odd indexes are the word; a sentence without it is one plain part.
 */
export function splitOnWord(sentence: string, word: string): string[] {
  if (!word) return [sentence];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.split(new RegExp(`(${escaped})`, 'i'));
}
