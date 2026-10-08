import type {FlashcardRecord} from '@core/db/types';

import {seedSnapshot} from '@test/support/lessonFlow';

import {lessonItemCodes, relatedReviewRows} from '../relatedReview';

const snapshot = seedSnapshot();

function card(itemKey: string): FlashcardRecord {
  return {itemKey, id: `card-${itemKey}`} as FlashcardRecord;
}

describe('related review (step 1, decision G5)', () => {
  it('is empty for a lesson that only brings new items and has no due cards', () => {
    expect(relatedReviewRows(snapshot, [])).toEqual([]);
  });

  it('lists recycled and prerequisite items and lesson items with due cards', () => {
    const lesson = {
      ...snapshot,
      lesson_items: snapshot.lesson_items!.map(entry =>
        entry.item.code === 'word:coffee'
          ? {...entry, introduction: 'recycled' as const}
          : entry,
      ),
    };
    const rows = relatedReviewRows(lesson, [
      card('word:tea'),
      card('word:not-in-lesson'),
    ]);
    expect(rows.map(row => [row.item.code, row.dueCard?.id ?? null])).toEqual([
      ['word:coffee', null],
      ['word:tea', 'card-word:tea'],
    ]);
    expect(lessonItemCodes(lesson)).toContain('pattern:can-i-have');
  });
});
