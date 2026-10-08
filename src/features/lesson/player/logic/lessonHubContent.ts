import {isWordLearningItem, learningItemsFromSnapshot} from '@core/learning';
import type {
  LessonAnalysis,
  LessonBlock,
  LessonSentence,
  LessonSnapshot,
} from '@core/schemas/lesson';

/** One vocabulary row in the lesson hub / vocabulary section. */
export type LessonVocabularyEntry = {
  key: string;
  word: string;
  meaning: string;
  ipa: string | null;
  pos: string | null;
};

/** One grammar card in the lesson hub / grammar section. */
export type LessonGrammarEntry = {
  key: string;
  name: string;
  nameVi: string | null;
  formula: string | null;
  explanation: string | null;
  /** Sentence-level analysis of how the point is used in this lesson. */
  inText: string | null;
  examples: {en: string; vi: string | null}[];
};

export function sortedSentences(snapshot: LessonSnapshot): LessonSentence[] {
  return [...snapshot.sentences].sort((a, b) => a.position - b.position);
}

export function sortedBlocks(snapshot: LessonSnapshot): LessonBlock[] {
  return [...snapshot.blocks].sort((a, b) => a.position - b.position);
}

/**
 * Stored analyses plus the ones fetched after download, keyed by sentence.
 * Display-only: the merged map is never written back to storage (AD-005).
 */
export function mergeAnalyses(
  stored: Record<string, LessonAnalysis>,
  late?: Record<string, LessonAnalysis>,
): Record<string, LessonAnalysis> {
  return {...stored, ...late};
}

/**
 * Lesson-level vocabulary: the words and phrases among the lesson's learning
 * items (catalog items of a curriculum lesson, else the analysed words) in
 * lesson order. Duplicate words (case-insensitive) keep the first occurrence.
 */
export function collectLessonVocabulary(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LessonVocabularyEntry[] {
  const seen = new Set<string>();
  const result: LessonVocabularyEntry[] = [];
  learningItemsFromSnapshot(snapshot, analyses)
    .filter(isWordLearningItem)
    .forEach(item => {
      const id = item.word.toLowerCase();
      if (seen.has(id)) return;
      seen.add(id);
      result.push({
        key: item.itemKey,
        word: item.word,
        meaning: item.meaningVi,
        ipa: item.ipa,
        pos: item.pos,
      });
    });
  return result;
}

/**
 * Lesson-level grammar from the per-sentence analyses (learner-made lessons).
 * Curriculum lessons teach sentence patterns as items instead; the pattern
 * section replaces this one in PR 6.
 */
export function collectLessonGrammar(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LessonGrammarEntry[] {
  const byName = new Map<string, LessonGrammarEntry>();
  const result: LessonGrammarEntry[] = [];
  sortedSentences(snapshot).forEach(sentence => {
    analyses[sentence.id]?.grammar.forEach(item => {
      if (byName.has(item.name.toLowerCase())) return;
      const entry: LessonGrammarEntry = {
        key: item.id,
        name: item.name,
        nameVi: null,
        formula: item.formula,
        explanation: item.description,
        inText: item.analysis,
        examples: [{en: sentence.text_en, vi: sentence.text_vi}],
      };
      byName.set(item.name.toLowerCase(), entry);
      result.push(entry);
    });
  });
  return result;
}
