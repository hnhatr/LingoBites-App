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

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

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

function vocabularyFromBlock(block: LessonBlock): LessonVocabularyEntry[] {
  const data = block.data;
  const rawItems = Array.isArray(data.items) ? data.items : [data];
  const entries: LessonVocabularyEntry[] = [];
  rawItems.forEach((raw, index) => {
    const item = recordOf(raw);
    if (!item) return;
    const word = textOf(item.word) ?? textOf(item.lemma) ?? textOf(item.nameEn);
    const meaning =
      textOf(item.meaningVi) ?? textOf(item.meaning) ?? textOf(item.nameVi);
    if (!word || !meaning) return;
    entries.push({
      key: `${block.id}-${index}`,
      word,
      meaning,
      ipa: textOf(item.ipa),
      pos: textOf(item.pos),
    });
  });
  return entries;
}

function grammarFromBlock(block: LessonBlock): LessonGrammarEntry | null {
  const data = block.data;
  const name = textOf(data.nameEn) ?? textOf(data.name) ?? textOf(block.title);
  if (!name) return null;
  const examples = Array.isArray(data.examples)
    ? data.examples.flatMap(raw => {
        const example = recordOf(raw);
        const en = example ? textOf(example.en) : null;
        return en ? [{en, vi: example ? textOf(example.vi) : null}] : [];
      })
    : [];
  return {
    key: block.id,
    name,
    nameVi: textOf(data.nameVi),
    formula: textOf(data.pattern) ?? textOf(data.formula),
    explanation: textOf(data.explanationVi) ?? textOf(data.description),
    inText: null,
    examples,
  };
}

/**
 * Lesson-level vocabulary: `vocabulary` blocks first, then words from the
 * per-sentence analyses in sentence order. Duplicate words (case-insensitive)
 * keep the first occurrence.
 */
export function collectLessonVocabulary(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LessonVocabularyEntry[] {
  const seen = new Set<string>();
  const result: LessonVocabularyEntry[] = [];
  const push = (entry: LessonVocabularyEntry) => {
    const id = entry.word.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    result.push(entry);
  };
  sortedBlocks(snapshot)
    .filter(block => block.type === 'vocabulary')
    .forEach(block => vocabularyFromBlock(block).forEach(push));
  sortedSentences(snapshot).forEach(sentence => {
    analyses[sentence.id]?.vocabulary.forEach(item =>
      push({
        key: item.id,
        word: item.word,
        meaning: item.meaning,
        ipa: item.ipa,
        pos: item.pos,
      }),
    );
  });
  return result;
}

/**
 * Lesson-level grammar: `grammar` blocks first, then points from the
 * per-sentence analyses. A point already listed by a block gains the
 * sentence analysis as its "in your text" note instead of a second card.
 */
export function collectLessonGrammar(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LessonGrammarEntry[] {
  const byName = new Map<string, LessonGrammarEntry>();
  const result: LessonGrammarEntry[] = [];
  sortedBlocks(snapshot)
    .filter(block => block.type === 'grammar')
    .forEach(block => {
      const entry = grammarFromBlock(block);
      if (!entry || byName.has(entry.name.toLowerCase())) return;
      byName.set(entry.name.toLowerCase(), entry);
      result.push(entry);
    });
  sortedSentences(snapshot).forEach(sentence => {
    analyses[sentence.id]?.grammar.forEach(item => {
      const existing = byName.get(item.name.toLowerCase());
      if (existing) {
        if (!existing.inText) existing.inText = item.analysis;
        return;
      }
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
