/**
 * Vocab path P5: the combo sets the learner opened, kept on the device so they
 * can be read offline. A set is saved when it opens and again when a batch is
 * added; its creation time stays the same.
 */
import {getDatabase} from '@core/db/database';

import {type ComboSentence, ComboSentenceSchema} from './comboClient';

export type LocalComboSet = {
  id: string;
  itemCode: string;
  grammarCode: string;
  situationCode: string;
  sentences: ComboSentence[];
  createdAt: string;
};

export type LocalComboSetSummary = Omit<LocalComboSet, 'sentences'> & {
  sentenceCount: number;
  /** The set's first sentence, shown on its history card. */
  preview?: {en: string; vi: string} | null;
};

type Row = {
  id: string;
  item_code: string;
  grammar_code: string;
  situation_code: string;
  sentences_json: string;
  created_at: string;
};

function rowsOf(result: {
  rows?: {length: number; item: (index: number) => unknown};
}): Row[] {
  const out: Row[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    out.push(result.rows!.item(index) as Row);
  }
  return out;
}

function sentencesOf(json: string): ComboSentence[] {
  try {
    const parsed = ComboSentenceSchema.array().safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Saves a set, or adds the sentences of a new batch to it. */
export function saveComboSet(
  set: Omit<LocalComboSet, 'createdAt'>,
  now: Date,
): void {
  getDatabase().execute(
    `INSERT INTO combo_sets_local (id, item_code, grammar_code, situation_code,
       sentences_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET sentences_json = excluded.sentences_json;`,
    [
      set.id,
      set.itemCode,
      set.grammarCode,
      set.situationCode,
      JSON.stringify(set.sentences),
      now.toISOString(),
    ],
  );
}

export function listLocalComboSets(): LocalComboSetSummary[] {
  return rowsOf(
    getDatabase().execute(
      `SELECT id, item_code, grammar_code, situation_code, sentences_json, created_at
         FROM combo_sets_local ORDER BY created_at DESC;`,
    ),
  ).map(row => {
    const sentences = sentencesOf(row.sentences_json);
    const first = sentences[0];
    return {
      id: row.id,
      itemCode: row.item_code,
      grammarCode: row.grammar_code,
      situationCode: row.situation_code,
      sentenceCount: sentences.length,
      preview: first ? {en: first.text_en, vi: first.text_vi} : null,
      createdAt: row.created_at,
    };
  });
}

export function readLocalComboSet(id: string): LocalComboSet | null {
  const row = rowsOf(
    getDatabase().execute(
      `SELECT id, item_code, grammar_code, situation_code, sentences_json, created_at
         FROM combo_sets_local WHERE id = ?;`,
      [id],
    ),
  )[0];
  if (!row) return null;
  return {
    id: row.id,
    itemCode: row.item_code,
    grammarCode: row.grammar_code,
    situationCode: row.situation_code,
    sentences: sentencesOf(row.sentences_json),
    createdAt: row.created_at,
  };
}

/** The situations of the newest sets on the device, newest first, no repeats. */
export function listRecentSituationCodes(limit: number): string[] {
  const result = getDatabase().execute(
    `SELECT situation_code FROM combo_sets_local
      GROUP BY situation_code ORDER BY MAX(created_at) DESC LIMIT ?;`,
    [limit],
  );
  const out: string[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows?.item(index) as {situation_code: string};
    out.push(row.situation_code);
  }
  return out;
}

/**
 * Vocab path P6 (stage-4 review): the sentences of the sets opened on the
 * device for one item, or for one tense when the code is a grammar item;
 * newest set first, one entry per set so a set's sentences stay together.
 */
export function listComboSentenceSetsFor(itemCode: string): ComboSentence[][] {
  return rowsOf(
    getDatabase().execute(
      `SELECT id, item_code, grammar_code, situation_code, sentences_json, created_at
         FROM combo_sets_local
        WHERE item_code = ? OR grammar_code = ?
        ORDER BY created_at DESC;`,
      [itemCode, itemCode],
    ),
  )
    .map(row => sentencesOf(row.sentences_json))
    .filter(sentences => sentences.length > 0);
}
