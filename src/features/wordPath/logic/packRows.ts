/**
 * Vocab path P5: the rows the word path shows, one per pack. A row says what a
 * pack teaches (its kinds and first items), whether it is a word pack or a
 * sentence pack, and where the learner is with it. Pure: callers pass what the
 * device and the Server know.
 */
import type {CatalogItem} from '@core/schemas/lesson';

import type {DownloadedPack} from './wordPackRepository';
import type {WordPath} from './wordPathClient';

export type PackKindCounts = {
  word: number;
  phrase: number;
  pattern: number;
  grammar: number;
};

export type PackPreviewItem = {text: string; meaning_vi: string};

/** Word packs teach single words; sentence packs teach phrases and patterns. */
export type PackKind = 'word' | 'sentence';

export type PackStatus = 'not_downloaded' | 'ready' | 'learning' | 'done';

export type PackRow = {
  packId: string;
  /** The Server's title, kept so the search still finds it. */
  titleVi: string;
  level: string;
  position: number;
  /** The topic's label, or null for packs without a topic. */
  topic: string | null;
  /** The topic code (`topic:food-drink`), which picks the default cover icon. */
  topicCode: string | null;
  /** The pack's cover picture; null shows the default cover. */
  coverUrl: string | null;
  total: number;
  learned: number;
  downloaded: boolean;
  kind: PackKind;
  kindCounts: PackKindCounts;
  preview: PackPreviewItem[];
  status: PackStatus;
};

export const PREVIEW_SIZE = 4;

const NO_KINDS: PackKindCounts = {word: 0, phrase: 0, pattern: 0, grammar: 0};

/** A sentence pack when phrases and patterns outnumber single words. */
export function packKindOf(counts: PackKindCounts): PackKind {
  return counts.phrase + counts.pattern > counts.word ? 'sentence' : 'word';
}

export function packStatusOf(
  downloaded: boolean,
  learned: number,
  total: number,
): PackStatus {
  if (!downloaded) return 'not_downloaded';
  if (total > 0 && learned >= total) return 'done';
  return learned > 0 ? 'learning' : 'ready';
}

/** Counts and first items of a pack from the items stored on the device. */
export function summaryOfItems(items: readonly CatalogItem[]): {
  kindCounts: PackKindCounts;
  preview: PackPreviewItem[];
} {
  const kindCounts = {...NO_KINDS};
  for (const item of items) {
    if (item.kind in kindCounts) {
      kindCounts[item.kind as keyof PackKindCounts] += 1;
    }
  }
  return {
    kindCounts,
    preview: items
      .slice(0, PREVIEW_SIZE)
      .map(item => ({text: item.text, meaning_vi: item.meaning_vi})),
  };
}

export type LocalPack = {
  pack: DownloadedPack;
  learned: number;
  items: readonly CatalogItem[];
};

function topicOf(topicCode: string | null, label: string): string | null {
  return topicCode ? label : null;
}

/** A topic code's label as the Server writes it: `topic:daily-life` → `daily life`. */
export function topicLabelOf(topicCode: string | null): string | null {
  return topicCode ? topicCode.replace(/^topic:/, '').replace(/-/g, ' ') : null;
}

/**
 * The Server's path when it can be reached; otherwise what is on the device.
 * A downloaded pack fills in what an older Server does not send.
 */
export function rowsFrom(
  path: WordPath | null,
  local: readonly LocalPack[],
): PackRow[] {
  const onDevice = new Map(local.map(entry => [entry.pack.packId, entry]));
  if (path) {
    return path.levels.flatMap(level =>
      level.topics.flatMap(topic =>
        topic.packs.map(pack => {
          const entry = onDevice.get(pack.id);
          const fromDevice = entry ? summaryOfItems(entry.items) : null;
          const kindCounts = pack.kind_counts ??
            fromDevice?.kindCounts ?? {...NO_KINDS, word: pack.item_count};
          const learned = entry?.learned ?? 0;
          return {
            packId: pack.id,
            titleVi: pack.title_vi,
            level: level.cefr_level,
            position: pack.position,
            topic: topicOf(topic.topic_code, topic.title_vi),
            topicCode: topic.topic_code,
            coverUrl: pack.cover_url ?? null,
            total: pack.item_count,
            learned,
            downloaded: Boolean(entry),
            kind: packKindOf(kindCounts),
            kindCounts,
            preview: pack.preview ?? fromDevice?.preview ?? [],
            status: packStatusOf(Boolean(entry), learned, pack.item_count),
          };
        }),
      ),
    );
  }
  return local.map(({pack, learned, items}) => {
    const summary = summaryOfItems(items);
    const total = pack.itemCodes.length;
    return {
      packId: pack.packId,
      titleVi: pack.titleVi,
      level: pack.cefrLevel,
      position: pack.position,
      topic: topicLabelOf(pack.topicCode),
      topicCode: pack.topicCode,
      // Covers are not kept on the device: offline packs show the default.
      coverUrl: null,
      total,
      learned,
      downloaded: true,
      kind: packKindOf(summary.kindCounts),
      kindCounts: summary.kindCounts,
      preview: summary.preview,
      status: packStatusOf(true, learned, total),
    };
  });
}

/** The pack to put first: the one being learned, else the first not finished. */
export function continuePackOf(rows: readonly PackRow[]): PackRow | null {
  return (
    rows.find(row => row.status === 'learning') ??
    rows.find(row => row.status !== 'done') ??
    null
  );
}

/** Rows whose title, topic or first items match the search. */
export function matchesQuery(row: PackRow, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    row.titleVi,
    row.topic ?? '',
    ...row.preview.flatMap(item => [item.text, item.meaning_vi]),
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(needle);
}
