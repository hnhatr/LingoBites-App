import type {
  LessonAnalysis,
  LessonItemEntry,
  LessonSnapshot,
} from '@core/schemas/lesson';

import {normalizeItemKey, vocabularyItemKey, vocabularyKind} from './itemKey';

/**
 * Where an item comes from: the shared catalog (`lesson_items` of a curriculum
 * lesson) or the sentence analyses of a learner-made lesson. Catalog items
 * carry their `itemId`, role and how the lesson introduces them.
 */
type LearningItemOrigin = {
  /**
   * Cross-lesson identity: the catalog item code (`word:coffee`,
   * `pattern:can-i-have`). Analysis words get the code the Server derives for
   * the same text, so a card saved today matches the catalog item later.
   */
  itemKey: string;
  itemId: string | null;
  source: 'catalog' | 'analysis';
  role: LessonItemEntry['role'] | null;
  introduction: LessonItemEntry['introduction'] | null;
  /** Current sentence ids of this lesson that carry or contain the item. */
  sentenceIds: string[];
};

export type WordLearningItem = LearningItemOrigin & {
  kind: 'word' | 'phrase';
  word: string;
  meaningVi: string;
  ipa: string | null;
  pos: string | null;
};

/** Patterns, pronunciation points and listening items (catalog only). */
export type CatalogLearningItem = LearningItemOrigin & {
  kind: 'pattern' | 'pronunciation' | 'listening';
  text: string;
  meaningVi: string;
  ipa: string | null;
  payload: Record<string, unknown>;
};

export type LearningItem = WordLearningItem | CatalogLearningItem;

export function isWordLearningItem(
  item: LearningItem,
): item is WordLearningItem {
  return item.kind === 'word' || item.kind === 'phrase';
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSentence(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Ids of the sentences whose English text contains the word or phrase. */
export function sentenceIdsContaining(
  normalizedKey: string,
  sentences: ReadonlyArray<{id: string; position: number; text_en: string}>,
): string[] {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(normalizedKey)}(?![\\p{L}\\p{N}])`,
    'u',
  );
  return [...sentences]
    .sort((a, b) => a.position - b.position)
    .filter(sentence => pattern.test(normalizeSentence(sentence.text_en)))
    .map(sentence => sentence.id);
}

function fromLessonItems(snapshot: LessonSnapshot): LearningItem[] {
  return [...(snapshot.lesson_items ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(entry => {
      const {item} = entry;
      const origin = {
        itemKey: item.code,
        itemId: item.id,
        source: 'catalog' as const,
        role: entry.role,
        introduction: entry.introduction,
      };
      if (item.kind === 'word' || item.kind === 'phrase') {
        const key = normalizeItemKey(item.text);
        return {
          ...origin,
          kind: item.kind,
          word: item.text,
          meaningVi: item.meaning_vi,
          ipa: item.ipa,
          pos: item.part_of_speech,
          sentenceIds: key
            ? sentenceIdsContaining(key, snapshot.sentences)
            : [],
        };
      }
      return {
        ...origin,
        kind: item.kind,
        text: item.text,
        meaningVi: item.meaning_vi,
        ipa: item.ipa,
        payload: item.payload,
        sentenceIds: [],
      };
    });
}

/**
 * Learner-made lessons have no catalog items yet: derive words and phrases
 * from the sentence analyses, keyed like the Server would code them. Analysis
 * grammar is not a pattern frame and stays out (decision G5).
 */
function fromAnalyses(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LearningItem[] {
  const byKey = new Map<string, WordLearningItem>();
  [...snapshot.sentences]
    .sort((a, b) => a.position - b.position)
    .forEach(sentence => {
      analyses[sentence.id]?.vocabulary.forEach(item => {
        const word = text(item.word);
        const meaningVi = text(item.meaning);
        const itemKey = word ? vocabularyItemKey(word) : null;
        if (!word || !meaningVi || !itemKey || byKey.has(itemKey)) {
          return;
        }
        const key = normalizeItemKey(word);
        byKey.set(itemKey, {
          kind: vocabularyKind(key),
          itemKey,
          itemId: null,
          source: 'analysis',
          role: null,
          introduction: null,
          word,
          meaningVi,
          ipa: text(item.ipa),
          pos: text(item.pos),
          sentenceIds: sentenceIdsContaining(key, snapshot.sentences),
        });
      });
    });
  return [...byKey.values()];
}

/**
 * Learning items of a downloaded lesson: its catalog items when it has any
 * (curriculum lessons), otherwise derived from the analyses. `analyses` lets a
 * caller add analyses fetched after the download (display-only, never stored).
 */
export function learningItemsFromSnapshot(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis> = snapshot.analyses,
): LearningItem[] {
  const catalog = fromLessonItems(snapshot);
  return catalog.length > 0 ? catalog : fromAnalyses(snapshot, analyses);
}
