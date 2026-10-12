import type {ItemKind} from '@core/learning/catalogItem';

import {bucketOf, mixReviewItems} from '../itemReviewMix';

/** Vocab path P5: today's item review mixes words, patterns and tenses, and does not stack one kind. */

type Entry = {id: string; item: {kind: ItemKind}};

function cards(prefix: string, kind: ItemKind, count: number): Entry[] {
  return Array.from({length: count}, (_, index) => ({
    id: `${prefix}-${index}`,
    item: {kind},
  }));
}

function longestRun(entries: Entry[]): number {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const entry of entries) {
    const bucket = bucketOf(entry.item.kind);
    run = bucket === previous ? run + 1 : 1;
    previous = bucket;
    best = Math.max(best, run);
  }
  return best;
}

it('gives about 60% words, 25% patterns and 15% tenses when there are enough of each', () => {
  const items = [
    ...cards('w', 'word', 30),
    ...cards('p', 'pattern', 30),
    ...cards('g', 'grammar', 30),
  ];
  const picked = mixReviewItems(items, 20);
  expect(picked).toHaveLength(20);
  const count = (prefix: string) =>
    picked.filter(entry => entry.id.startsWith(prefix)).length;
  expect(count('w')).toBe(12);
  expect(count('p')).toBe(5);
  expect(count('g')).toBe(3);
});

it('hands a kind that runs short to the others, so the budget is still used', () => {
  const items = [
    ...cards('w', 'word', 10),
    ...cards('p', 'pattern', 5),
    ...cards('g', 'grammar', 5),
  ];
  const picked = mixReviewItems(items, 20);
  expect(picked).toHaveLength(20);
  expect(picked.filter(entry => entry.id.startsWith('w'))).toHaveLength(10);
});

it('keeps no more than two cards of one kind in a row when the mix allows it', () => {
  const items = [
    ...cards('w', 'word', 12),
    ...cards('p', 'pattern', 6),
    ...cards('g', 'grammar', 4),
  ];
  const picked = mixReviewItems(items, 22);
  expect(picked).toHaveLength(22);
  expect(longestRun(picked)).toBeLessThanOrEqual(2);
});

it('keeps the most overdue card first within each kind', () => {
  const items = [...cards('w', 'word', 4), ...cards('p', 'pattern', 4)];
  const picked = mixReviewItems(items, 8);
  const words = picked
    .filter(entry => entry.id.startsWith('w'))
    .map(entry => entry.id);
  const patterns = picked
    .filter(entry => entry.id.startsWith('p'))
    .map(entry => entry.id);
  expect(words).toEqual(['w-0', 'w-1', 'w-2', 'w-3']);
  expect(patterns).toEqual(['p-0', 'p-1', 'p-2', 'p-3']);
});

it('never shows more than the budget, and nothing when there is no budget', () => {
  const items = cards('w', 'word', 20);
  expect(mixReviewItems(items, 5)).toHaveLength(5);
  expect(mixReviewItems(items, 0)).toEqual([]);
  expect(mixReviewItems([], 10)).toEqual([]);
});
