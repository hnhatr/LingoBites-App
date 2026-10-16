import {useEffect, useState} from 'react';
import {z} from 'zod';

import {
  type ApiResult,
  jsonBody,
  type JsonRequestOptions,
  requestJson,
} from '@core/api/jsonRequest';
import {getDatabase} from '@core/db/database';

/**
 * Vocab path P6 (F7): the items a unit's summative task asks for, ticked while
 * the learner writes. Words and phrases match by their spellings, patterns by
 * the fixed parts of their frame in order (the Server sends both); tenses only
 * the Server can read, so they are checked when the answer is sent.
 */

export const ChecklistMatchSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('forms'), forms: z.array(z.string())}),
  z.object({type: z.literal('fixed_parts'), parts: z.array(z.string())}),
  z.object({type: z.literal('tense')}),
]);

export const ChecklistEntrySchema = z.object({
  code: z.string(),
  kind: z.string(),
  text: z.string(),
  meaning_vi: z.string(),
  match: ChecklistMatchSchema,
});

export const ChecklistSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  task_id: z.string().nullable(),
  items: z.array(ChecklistEntrySchema),
});

export const CoverageSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  task_id: z.string().nullable(),
  items: z.array(z.object({code: z.string(), used: z.boolean()})),
});

export type ChecklistEntry = z.infer<typeof ChecklistEntrySchema>;
export type ChecklistMatch = z.infer<typeof ChecklistMatchSchema>;

export function fetchSummativeChecklist(
  unitId: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<z.infer<typeof ChecklistSchema>>> {
  return requestJson(
    ChecklistSchema,
    `/v1/units/${encodeURIComponent(unitId)}/summative-task/checklist`,
    {method: 'GET'},
    options,
  );
}

export function checkSummativeCoverage(
  unitId: string,
  text: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<z.infer<typeof CoverageSchema>>> {
  return requestJson(
    CoverageSchema,
    `/v1/units/${encodeURIComponent(unitId)}/summative-task/coverage`,
    jsonBody({text: text.slice(0, 5000)}),
    options,
  );
}

// COPY of the Server's `curriculum/tasks/model/summativeChecklist.ts`
// (`wordsOf`, `usesEntry`); keep both in sync.

/** Lower-case words of a text, apostrophes kept (`don't`), everything else a break. */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .split(/[^a-z0-9']+/)
    .map(word => word.replace(/^'+|'+$/g, ''))
    .filter(word => word.length > 0);
}

function findSequence(
  words: readonly string[],
  sequence: readonly string[],
  from: number,
): number {
  if (sequence.length === 0) return from;
  for (let i = from; i + sequence.length <= words.length; i += 1) {
    if (sequence.every((word, j) => words[i + j] === word)) {
      return i + sequence.length;
    }
  }
  return -1;
}

/** Whether the words use a word, phrase or pattern entry; null for a tense (the Server reads it). */
export function usesEntry(
  words: readonly string[],
  match: ChecklistMatch,
): boolean | null {
  switch (match.type) {
    case 'forms':
      return match.forms.some(
        form => findSequence(words, form.split(' '), 0) >= 0,
      );
    case 'fixed_parts': {
      let cursor = 0;
      for (const part of match.parts) {
        cursor = findSequence(words, part.split(' '), cursor);
        if (cursor < 0) return false;
      }
      return match.parts.length > 0;
    }
    case 'tense':
      return null;
  }
}

const CACHE_PREFIX = 'summative_checklist.';

function readCached(unitId: string): ChecklistEntry[] | null {
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        `${CACHE_PREFIX}${unitId}`,
      ])
      .rows?.item(0) as {value?: string} | undefined;
    if (!row?.value) return null;
    const parsed = z
      .array(ChecklistEntrySchema)
      .safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function cache(unitId: string, entries: ChecklistEntry[]): void {
  try {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [
        `${CACHE_PREFIX}${unitId}`,
        JSON.stringify(entries),
        new Date().toISOString(),
      ],
    );
  } catch {
    // Only the offline copy is lost.
  }
}

/**
 * The checklist of a unit's summative task: the kept copy at once, then the
 * Server's. Empty when the task asks for nothing or nothing is known yet.
 */
export function useSummativeChecklist(unitId: string): ChecklistEntry[] {
  const [entries, setEntries] = useState<ChecklistEntry[]>(
    () => readCached(unitId) ?? [],
  );
  useEffect(() => {
    let alive = true;
    fetchSummativeChecklist(unitId)
      .then(result => {
        if (!result.ok) return;
        cache(unitId, result.value.items);
        if (alive) setEntries(result.value.items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [unitId]);
  return entries;
}
