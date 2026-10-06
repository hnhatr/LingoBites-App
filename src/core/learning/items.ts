import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {normalizeItemKey, vocabularyItemKey, vocabularyKind} from './itemKey';

/**
 * The learning items of one lesson: the stable unit that practice, review and
 * games work on. `itemKey` is the cross-lesson identity (`word:coffee`,
 * `phrase:wake up`, `grammar:present simple`).
 */
export type WordLearningItem = {
  kind: 'word' | 'phrase';
  itemKey: string;
  word: string;
  meaningVi: string;
  ipa: string | null;
  pos: string | null;
  /** Current sentence ids of this lesson that carry or contain the word. */
  sentenceIds: string[];
};

export type GrammarLearningItem = {
  kind: 'grammar';
  itemKey: string;
  name: string;
  nameVi: string | null;
  formula: string | null;
  description: string | null;
  sentenceIds: string[];
};

export type LearningItem = WordLearningItem | GrammarLearningItem;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
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

function fromServerItems(snapshot: LessonSnapshot): LearningItem[] {
  const current = new Set(snapshot.sentences.map(sentence => sentence.id));
  const items: LearningItem[] = [];
  for (const raw of snapshot.items ?? []) {
    const payload = record(raw.payload);
    if (!payload) {
      continue;
    }
    const sentenceIds = (raw.sentence_ids ?? []).filter(id => current.has(id));
    if (raw.kind === 'grammar') {
      const name = text(payload.name);
      if (!name) {
        continue;
      }
      items.push({
        kind: 'grammar',
        itemKey: `grammar:${raw.item_key}`,
        name,
        nameVi: text(payload.name_vi),
        formula: text(payload.formula),
        description: text(payload.description),
        sentenceIds,
      });
    } else {
      const word = text(payload.word);
      const meaningVi = text(payload.meaning_vi);
      if (!word || !meaningVi) {
        continue;
      }
      items.push({
        kind: raw.kind,
        itemKey: `${raw.kind}:${raw.item_key}`,
        word,
        meaningVi,
        ipa: text(payload.ipa),
        pos: text(payload.pos),
        sentenceIds,
      });
    }
  }
  return items;
}

/**
 * Downloads made before the Server sent `items[]` still carry the same
 * knowledge in `vocabulary` blocks and stored analyses; derive words and
 * grammar from those with the same keys the Server would have produced.
 */
function fromBlocksAndAnalyses(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LearningItem[] {
  const byKey = new Map<string, LearningItem>();
  const addWord = (
    word: string | null,
    meaningVi: string | null,
    ipa: string | null,
    pos: string | null,
  ) => {
    if (!word || !meaningVi) {
      return;
    }
    const itemKey = vocabularyItemKey(word);
    if (!itemKey || byKey.has(itemKey)) {
      return; // blocks come first and win, like the Server's derivation
    }
    const key = normalizeItemKey(word);
    byKey.set(itemKey, {
      kind: vocabularyKind(key),
      itemKey,
      word,
      meaningVi,
      ipa,
      pos,
      sentenceIds: sentenceIdsContaining(key, snapshot.sentences),
    });
  };

  [...snapshot.blocks]
    .sort((a, b) => a.position - b.position)
    .filter(block => block.type === 'vocabulary')
    .forEach(block => {
      const rawItems = Array.isArray(block.data.items) ? block.data.items : [];
      rawItems.forEach(raw => {
        const item = record(raw);
        if (!item) {
          return;
        }
        addWord(
          text(item.word) ?? text(item.lemma),
          text(item.meaningVi) ?? text(item.meaning),
          text(item.ipa) ?? text(item.pronunciation),
          text(item.pos),
        );
      });
    });

  [...snapshot.sentences]
    .sort((a, b) => a.position - b.position)
    .forEach(sentence => {
      const analysis = analyses[sentence.id];
      analysis?.vocabulary.forEach(item =>
        addWord(
          text(item.word),
          text(item.meaning),
          text(item.ipa),
          text(item.pos),
        ),
      );
      analysis?.grammar.forEach(item => {
        const key = normalizeItemKey(item.name);
        const itemKey = key ? `grammar:${key}` : null;
        if (!itemKey) {
          return;
        }
        const existing = byKey.get(itemKey);
        if (existing) {
          if (!existing.sentenceIds.includes(sentence.id)) {
            existing.sentenceIds.push(sentence.id);
          }
          return;
        }
        byKey.set(itemKey, {
          kind: 'grammar',
          itemKey,
          name: item.name.trim(),
          nameVi: null,
          formula: text(item.formula),
          description: text(item.description),
          sentenceIds: [sentence.id],
        });
      });
    });
  return [...byKey.values()];
}

/**
 * Learning items of a downloaded lesson: the Server's `items[]` when the
 * snapshot has them, otherwise derived on the device. `analyses` lets a caller
 * add analyses fetched after the download (display-only, never stored).
 */
export function learningItemsFromSnapshot(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis> = snapshot.analyses,
): LearningItem[] {
  const fromServer = fromServerItems(snapshot);
  return fromServer.length > 0
    ? fromServer
    : fromBlocksAndAnalyses(snapshot, analyses);
}
