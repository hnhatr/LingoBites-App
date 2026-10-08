import type {FlashcardRecord} from '@core/db/types';
import type {CatalogItem, LessonSnapshot} from '@core/schemas/lesson';

export type ReviewRow = {
  item: CatalogItem;
  /** The learner's due card for this item, if any (rated in place). */
  dueCard: FlashcardRecord | null;
};

/**
 * Step 1 "Ôn liên quan" (decision G5): the lesson's recycled and
 * prerequisite items, plus any lesson item whose saved card is due, in the
 * lesson's item order.
 */
export function relatedReviewRows(
  snapshot: LessonSnapshot,
  dueCards: readonly FlashcardRecord[],
): ReviewRow[] {
  const dueByKey = new Map(
    dueCards.flatMap(card => (card.itemKey ? [[card.itemKey, card]] : [])),
  );
  return [...(snapshot.lesson_items ?? [])]
    .sort((a, b) => a.position - b.position)
    .filter(
      entry => entry.introduction !== 'new' || dueByKey.has(entry.item.code),
    )
    .map(entry => ({
      item: entry.item,
      dueCard: dueByKey.get(entry.item.code) ?? null,
    }));
}

/** Catalog codes of every lesson item (to look up due cards). */
export function lessonItemCodes(snapshot: LessonSnapshot): string[] {
  return (snapshot.lesson_items ?? []).map(entry => entry.item.code);
}
