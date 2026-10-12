import type {ItemKind} from '@core/learning/catalogItem';

/**
 * Vocab path P5: the order of today's item review. About 60% words and phrases,
 * 25% patterns, 15% tenses; a shortfall in one kind goes to the others; and no
 * more than two cards of one kind in a row when the mix allows it. Within a kind
 * the most overdue card comes first.
 */

export type ReviewBucket = 'words' | 'patterns' | 'grammar';

export const REVIEW_SHARES: Record<ReviewBucket, number> = {
  words: 0.6,
  patterns: 0.25,
  grammar: 0.15,
};

export const MAX_SAME_BUCKET_IN_A_ROW = 2;

const BUCKETS: readonly ReviewBucket[] = ['words', 'patterns', 'grammar'];

/** Pronunciation and listening cards are exercises, so they sit with patterns. */
export function bucketOf(kind: ItemKind): ReviewBucket {
  if (kind === 'word' || kind === 'phrase') return 'words';
  if (kind === 'grammar') return 'grammar';
  return 'patterns';
}

/** How many cards each kind gets out of `count`, with a shortfall handed to kinds that have more. */
function quotasFor<T>(
  byBucket: Record<ReviewBucket, T[]>,
  count: number,
): Record<ReviewBucket, number> {
  const quota: Record<ReviewBucket, number> = {
    words: Math.round(count * REVIEW_SHARES.words),
    patterns: Math.round(count * REVIEW_SHARES.patterns),
    grammar: 0,
  };
  quota.grammar = count - quota.words - quota.patterns;
  let spare = 0;
  for (const bucket of BUCKETS) {
    const take = Math.min(quota[bucket], byBucket[bucket].length);
    spare += quota[bucket] - take;
    quota[bucket] = take;
  }
  while (spare > 0) {
    const open = BUCKETS.filter(
      bucket => quota[bucket] < byBucket[bucket].length,
    );
    if (open.length === 0) break;
    for (const bucket of open) {
      if (spare === 0) break;
      quota[bucket] += 1;
      spare -= 1;
    }
  }
  return quota;
}

/**
 * The cards to show today, in order. `items` must already be in the order
 * wanted within each kind (most overdue first).
 */
export function mixReviewItems<T extends {item: {kind: ItemKind}}>(
  items: readonly T[],
  budget: number,
): T[] {
  const count = Math.max(0, Math.min(budget, items.length));
  if (count === 0) return [];
  const byBucket: Record<ReviewBucket, T[]> = {
    words: [],
    patterns: [],
    grammar: [],
  };
  for (const entry of items) byBucket[bucketOf(entry.item.kind)].push(entry);
  const quota = quotasFor(byBucket, count);

  const out: T[] = [];
  const next: Record<ReviewBucket, number> = {
    words: 0,
    patterns: 0,
    grammar: 0,
  };
  const recent: ReviewBucket[] = [];
  while (out.length < count) {
    const open = BUCKETS.filter(bucket => quota[bucket] > 0);
    if (open.length === 0) break;
    // The kind with the most cards still to show goes next, unless it would be a third in a row.
    const ranked = [...open].sort(
      (a, b) => quota[b] - quota[a] || BUCKETS.indexOf(a) - BUCKETS.indexOf(b),
    );
    const blocked = (bucket: ReviewBucket) =>
      recent.length >= MAX_SAME_BUCKET_IN_A_ROW &&
      recent.slice(-MAX_SAME_BUCKET_IN_A_ROW).every(value => value === bucket);
    const pick = ranked.find(bucket => !blocked(bucket)) ?? ranked[0]!;
    out.push(byBucket[pick][next[pick]]!);
    next[pick] += 1;
    quota[pick] -= 1;
    recent.push(pick);
  }
  return out;
}
