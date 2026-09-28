import {
  pickKeyword,
  type SentenceEnrichment,
  type VocabEntry,
} from '@shared/schemas/sentence-contract';

/**
 * SETE-329 (TASK-2, Stage 1): client pipeline for one sentence card.
 *
 * A card carries exactly 3 AI blocks — keyword, vocab, grammar — filled
 * asynchronously. Each block is in one of four states:
 * - `pending`: skeleton placeholder, data not here yet.
 * - `ready`: block renders its content.
 * - `failed`: block renders its own error + retry; the rest of the card
 *   is unaffected.
 * - `omitted`: data is missing but nothing failed (status `partial`/`ready`
 *   with an empty array) — the card renders shorter, never an error and
 *   never an empty placeholder.
 *
 * The keyword block never omits: a null AI keyword falls back to
 * `pickKeyword` (longest content word, BTASK-3).
 */
export type SentenceBlockId = 'keyword' | 'vocab' | 'grammar';

export const SENTENCE_BLOCK_IDS: readonly SentenceBlockId[] = [
  'keyword',
  'vocab',
  'grammar',
] as const;

export type SentenceBlockState = 'pending' | 'ready' | 'failed' | 'omitted';

export type SentenceBlockStates = Record<SentenceBlockId, SentenceBlockState>;

/**
 * Per-block fetch errors owned by the retry layer (key = block that failed
 * its last fetch). A set error forces that block to `failed` regardless of
 * what the enrichment payload carries.
 */
export type SentenceBlockErrors = Partial<Record<SentenceBlockId, string>>;

function listState(
  count: number,
  status: SentenceEnrichment['status'],
): SentenceBlockState {
  if (count > 0) {
    return 'ready';
  }
  // Missing data is only an error when the sentence itself failed; a
  // `partial`/`ready` sentence with an empty list renders a shorter card.
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'pending') {
    return 'pending';
  }
  return 'omitted';
}

export function deriveBlockState(
  block: SentenceBlockId,
  enrichment: SentenceEnrichment | null,
  errors: SentenceBlockErrors = {},
): SentenceBlockState {
  if (errors[block] != null && errors[block] !== '') {
    return 'failed';
  }
  if (enrichment == null) {
    return 'pending';
  }
  if (block === 'keyword') {
    // Null AI keyword is covered by the pickKeyword fallback, so the
    // keyword block is ready as soon as enrichment exists.
    return 'ready';
  }
  if (block === 'vocab') {
    return listState(enrichment.vocab.length, enrichment.status);
  }
  return listState(enrichment.grammar.length, enrichment.status);
}

export function deriveBlockStates(
  enrichment: SentenceEnrichment | null,
  errors: SentenceBlockErrors = {},
): SentenceBlockStates {
  return {
    keyword: deriveBlockState('keyword', enrichment, errors),
    vocab: deriveBlockState('vocab', enrichment, errors),
    grammar: deriveBlockState('grammar', enrichment, errors),
  };
}

/** Keyword to display: AI keyword, or the longest-content-word fallback. */
export function resolveKeyword(
  en: string,
  enrichment: SentenceEnrichment | null,
): string {
  return pickKeyword(en, enrichment?.keyWord ?? null);
}

/** Vocab rows to render. Function words keep only their in-sentence note. */
export function resolveVocab(
  enrichment: SentenceEnrichment | null,
): VocabEntry[] {
  return enrichment?.vocab ?? [];
}

/** True when at least one block was dropped without error (short card). */
export function isPartialCard(states: SentenceBlockStates): boolean {
  return (
    states.keyword === 'omitted' ||
    states.vocab === 'omitted' ||
    states.grammar === 'omitted'
  );
}
