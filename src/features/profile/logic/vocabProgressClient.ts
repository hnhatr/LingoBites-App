/**
 * Vocab path P6 (F9): the learner's progress along words, patterns and tenses
 * (`GET /v1/me/vocab-progress`). The last answer is kept for the session, so
 * the report still shows it when the network drops.
 */
import {z} from 'zod';

import {
  type ApiResult,
  type JsonRequestOptions,
  requestJson,
} from '@core/api/jsonRequest';
import {getDatabase} from '@core/db/database';

const Counts = {
  total: z.number().int(),
  learning: z.number().int(),
  stable: z.number().int(),
};

export const VocabProgressSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  words: z.array(z.object({cefr_level: z.string(), ...Counts})),
  patterns: z.array(
    z.object({function: z.string(), label_vi: z.string(), ...Counts}),
  ),
  pattern_summary: z.object(Counts),
  tenses: z.array(
    z.object({
      code: z.string(),
      text: z.string(),
      time: z.string().nullable(),
      aspect: z.string().nullable(),
      stage: z.number().int().nullable(),
      stable: z.boolean(),
    }),
  ),
});

export type VocabProgress = z.infer<typeof VocabProgressSchema>;

/** The session copy, with the account it belongs to. */
let last: {account: string | null; progress: VocabProgress} | null = null;

function currentAccount(): string | null {
  try {
    const row = getDatabase()
      .execute(
        "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
      )
      .rows?.item(0) as {value?: string} | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** The progress the Server last sent in this session, if it is this account's. */
export function lastVocabProgress(): VocabProgress | null {
  return last && last.account === currentAccount() ? last.progress : null;
}

/** Forgets the session copy (tests). */
export function clearVocabProgress(): void {
  last = null;
}

export async function fetchVocabProgress(
  options: JsonRequestOptions = {},
): Promise<ApiResult<VocabProgress>> {
  const result = await requestJson(
    VocabProgressSchema,
    '/v1/me/vocab-progress',
    {method: 'GET'},
    options,
  );
  if (result.ok) last = {account: currentAccount(), progress: result.value};
  return result;
}
