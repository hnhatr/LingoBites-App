import {learnItems} from './libraryClient';
import {saveLearnedItems} from './libraryRepository';

/**
 * Vocab path P6: "Thêm vào ôn" on a pattern or a tense. The Server writes the
 * schedule (stage 0) and the device keeps the item's content so review can ask
 * it offline; the schedule row itself comes with the next sync pull.
 */
export type AddToReviewResult =
  {ok: true; alreadyScheduled: boolean} | {ok: false; offline: boolean};

export async function addToReview(
  itemCode: string,
  now: Date = new Date(),
): Promise<AddToReviewResult> {
  const result = await learnItems([itemCode]);
  if (!result.ok) {
    return {ok: false, offline: result.kind === 'network-error'};
  }
  try {
    saveLearnedItems(result.value.items, now);
  } catch {
    // The content comes again with the library's next refresh.
  }
  return {ok: true, alreadyScheduled: result.value.enrolled === 0};
}
