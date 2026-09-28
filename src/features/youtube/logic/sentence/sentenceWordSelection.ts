import type {GrammarPoint, VocabEntry} from '@shared/schemas/sentence-contract';

/**
 * SETE-331 (TASK-4, Stage 2): pure helpers for the interactive word +
 * grammar blocks inside `SentenceCard`.
 *
 * Kept dependency-free so unit tests cover tokenization, selection, and
 * save-label logic without rendering. Persistence itself stays with the
 * parent (FlashcardRepository / GrammarBookmarkRepository via
 * `useBookmarkOptimistic`); this module only resolves *what* to save.
 */

export type SentenceWordToken = {
  /** Exact slice to render (word, punctuation, or whitespace). */
  text: string;
  /** Only word tokens are tappable; punctuation/whitespace never are. */
  tappable: boolean;
  /** Lowercased word for vocab lookup; null when not tappable. */
  normalizedWord: string | null;
};

const WORD_RE = /^[A-Za-z']+$/;

/**
 * Splits a sentence into render tokens. Words (`[A-Za-z']+`) are tappable;
 * punctuation marks and whitespace are preserved but never tappable.
 */
export function tokenizeSentenceWords(en: string): SentenceWordToken[] {
  if (en === '') {
    return [];
  }
  const parts = en.split(/([A-Za-z']+|\s+)/g).filter(p => p !== '');
  return parts.map(text => {
    const tappable = WORD_RE.test(text);
    return {
      text,
      tappable,
      normalizedWord: tappable ? text.toLowerCase() : null,
    };
  });
}

/** Case-insensitive vocab lookup for the currently selected word. */
export function findVocabEntry(
  vocab: readonly VocabEntry[],
  word: string,
): VocabEntry | undefined {
  const needle = word.toLowerCase();
  return vocab.find(entry => entry.word.toLowerCase() === needle);
}

/** Function words (pos `từ chức năng`) render the shortened in-sentence note. */
export function isFunctionWordEntry(entry: VocabEntry): boolean {
  return entry.pos === 'từ chức năng';
}

/**
 * Shortened body for function words: the contract's `Trong câu: …` note.
 * Falls back to meaning when the note is absent.
 */
export function formatFunctionWordNote(entry: VocabEntry): string {
  return entry.inSentenceNote ?? entry.meaning;
}

/** Badge label for the i-th grammar point (0-based) of n total. */
export function formatGrammarBadge(index: number, total: number): string {
  return `NGỮ PHÁP ${index + 1}/${total}`;
}

/** One highlighted span inside the Vietnamese translation. */
export type ViHighlight = {
  before: string;
  match: string;
  after: string;
};

/**
 * SETE-335 (TASK-8): v1 client-side inference for the dynamic VI underline.
 * The contract has no word↔translation-phrase mapping field, so the client
 * guesses which VI span corresponds to the selected entry from its
 * `meaning` (plus `inSentenceNote`/`tip`, both Vietnamese). Longest
 * candidate wins; returns null when nothing matches. Case-insensitive,
 * original casing preserved in the returned slices.
 */
export function findViHighlight(
  vi: string,
  entry: VocabEntry | undefined,
): ViHighlight | null {
  if (entry === undefined || vi === '') {
    return null;
  }
  const sources = [entry.meaning, entry.inSentenceNote, entry.tip].filter(
    (s): s is string => typeof s === 'string' && s !== '',
  );
  const candidates: string[] = [];
  for (const source of sources) {
    candidates.push(source);
    for (const part of source.split(/[,;/.()|·•\-–—:]+/)) {
      const trimmed = part.trim();
      if (trimmed !== '') {
        candidates.push(trimmed);
      }
    }
    for (const word of source.split(/\s+/)) {
      const trimmed = word
        .trim()
        .replace(/^[,.();:!?'"“”‘’]+|[,.();:!?'"“”‘’]+$/g, '');
      if (trimmed.length >= 2) {
        candidates.push(trimmed);
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length);
  const lowerVi = vi.toLowerCase();
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (key.length < 2 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const index = lowerVi.indexOf(key);
    if (index >= 0) {
      return {
        before: vi.slice(0, index),
        match: vi.slice(index, index + candidate.length),
        after: vi.slice(index + candidate.length),
      };
    }
  }
  return null;
}

/** Stable save key for a word within one sentence card. */
export function wordSaveKey(word: string): string {
  return word.toLowerCase();
}

/** Stable save key for a grammar point (its display name). */
export function grammarSaveKey(point: GrammarPoint): string {
  return point.name;
}
