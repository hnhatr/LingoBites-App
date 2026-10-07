import {getLessonDownloadsSignature} from '@features/lesson/player';
import {
  getBookmarkedGrammarSignature,
  getSavedFlashcardsSignature,
} from '@features/review';

/** Which local data a Library screen shows. */
export interface LibrarySignatureNeeds {
  vocabulary?: boolean;
  grammar?: boolean;
}

/**
 * A cheap fingerprint of the local data behind the Library: it changes when a
 * lesson is downloaded, updated or removed, or a word/grammar point is saved
 * or unsaved. Screens compare it on refocus and only reload when it moved.
 */
export function readLibrarySignature(needs: LibrarySignatureNeeds): string {
  // Every segment resolves titles and sources through the downloads.
  const parts = [getLessonDownloadsSignature()];
  if (needs.vocabulary) parts.push(getSavedFlashcardsSignature().signature);
  if (needs.grammar) parts.push(getBookmarkedGrammarSignature().signature);
  return parts.join('|');
}
