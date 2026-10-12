import {learnedCount, listDownloadedPacks} from './wordPackRepository';

/**
 * Vocab path P5: the pack the learner should open next, from the packs on the
 * device: the first, in level and position order, that still has words not yet
 * in the schedule. Null when every downloaded pack is learned or none is there.
 */
export type NextPack = {
  packId: string;
  titleVi: string;
  learned: number;
  total: number;
};

export function nextDownloadedPack(): NextPack | null {
  for (const pack of listDownloadedPacks()) {
    const total = pack.itemCodes.length;
    if (total === 0) continue;
    const learned = learnedCount(pack.itemCodes);
    if (learned < total) {
      return {packId: pack.packId, titleVi: pack.titleVi, learned, total};
    }
  }
  return null;
}
