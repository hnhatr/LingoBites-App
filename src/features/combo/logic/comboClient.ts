/**
 * Vocab path P5: combo sets on the Server (`/v1/combo/*`). Options, situations,
 * opening a set, adding to it, reading a set and its history, and reporting a
 * sentence. Responses are checked with zod; failures come back as values.
 */
import {z} from 'zod';

import {
  type ApiResult,
  jsonBody,
  type JsonRequestOptions,
  requestJson,
} from '@core/api/jsonRequest';

export const ComboTokenSchema = z.object({
  t: z.string(),
  ipa: z.string().nullable(),
  role: z.enum(['subject', 'aux', 'verb', 'item', 'other']),
});

/** "Phân tích ngữ pháp": the Server works it out from the sentence; older sets have none. */
export const ComboAnalysisSchema = z.object({
  tense: z
    .object({
      code: z.string().nullable(),
      time: z.string(),
      aspect: z.string(),
      name_vi: z.string(),
      polarity_vi: z.string(),
      formula: z.string(),
    })
    .nullable(),
  parts: z.array(
    z.object({text: z.string(), role: z.string(), label_vi: z.string()}),
  ),
  notes: z.array(z.string()),
});

export const ComboSentenceSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  batch: z.number().int(),
  subject_group: z.string(),
  subject_text: z.string(),
  polarity: z.string(),
  text_en: z.string(),
  text_vi: z.string(),
  tokens: z.array(ComboTokenSchema),
  analysis: ComboAnalysisSchema.optional(),
});

export const ComboSetSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  set_id: z.string(),
  sentences: z.array(ComboSentenceSchema),
  missing: z.number().int().optional(),
  reason: z.string().nullable().optional(),
});

export const ComboOptionsSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  tense_mode: z.string(),
  tenses: z.array(
    z.object({
      code: z.string(),
      name_en: z.string(),
      time: z.string(),
      aspect: z.string(),
    }),
  ),
  subject_groups: z.array(z.string()),
  polarities: z.array(z.string()),
  batch_sizes: z.array(z.number().int()),
  max_per_set: z.number().int(),
  ai_left_today: z.number().int(),
  sets_left_today: z.number().int(),
});

export const ComboSituationsSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  situations: z.array(
    z.object({
      code: z.string(),
      title_en: z.string(),
      title_vi: z.string(),
      register: z.string(),
      level_code: z.string(),
    }),
  ),
});

export const ComboSetsSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  sets: z.array(
    z.object({
      id: z.string(),
      item_code: z.string(),
      grammar_code: z.string(),
      situation_code: z.string(),
      sentence_count: z.number().int(),
      created_at: z.string(),
    }),
  ),
});

export const ComboReportSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  flagged: z.boolean(),
});

export type ComboToken = z.infer<typeof ComboTokenSchema>;
export type ComboSentence = z.infer<typeof ComboSentenceSchema>;
export type ComboAnalysis = z.infer<typeof ComboAnalysisSchema>;
export type ComboSet = z.infer<typeof ComboSetSchema>;
export type ComboOptions = z.infer<typeof ComboOptionsSchema>;
export type ComboSetSummary = z.infer<typeof ComboSetsSchema>['sets'][number];
export type ComboReportReason =
  'wrong_meaning' | 'unnatural' | 'wrong_tense' | 'wrong_subject' | 'other';

export type ComboPolarity = 'affirmative' | 'negative' | 'question';

export type OpenComboSetInput = {
  itemCode: string;
  /** Left out for a locked pattern, which has no tense. */
  grammarCode?: string;
  situationCode: string;
  /** Sentences of each polarity in a batch, e.g. 3 affirmative and 6 questions. */
  polarityCounts: Partial<Record<ComboPolarity, number>>;
  /** The subject groups the learner picked; all the item allows when absent. */
  subjectGroups?: string[];
};

export function fetchComboOptions(
  itemCode: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<ComboOptions>> {
  const qs = new URLSearchParams({item: itemCode}).toString();
  return requestJson(
    ComboOptionsSchema,
    `/v1/combo/options?${qs}`,
    {method: 'GET'},
    options,
  );
}

export function fetchComboSituations(
  itemCode: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<z.infer<typeof ComboSituationsSchema>>> {
  const qs = new URLSearchParams({item: itemCode}).toString();
  return requestJson(
    ComboSituationsSchema,
    `/v1/combo/situations?${qs}`,
    {method: 'GET'},
    options,
  );
}

export function openComboSet(
  input: OpenComboSetInput,
  options: JsonRequestOptions = {},
): Promise<ApiResult<ComboSet>> {
  return requestJson(
    ComboSetSchema,
    '/v1/combo/sets',
    jsonBody({
      item_code: input.itemCode,
      ...(input.grammarCode ? {grammar_code: input.grammarCode} : {}),
      situation_code: input.situationCode,
      polarity_counts: input.polarityCounts,
      ...(input.subjectGroups ? {subject_groups: input.subjectGroups} : {}),
    }),
    options,
  );
}

/** "Tải thêm": the Server repeats the polarity mix the set was opened with. */
export function addToComboSet(
  setId: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<ComboSet>> {
  return requestJson(
    ComboSetSchema,
    `/v1/combo/sets/${encodeURIComponent(setId)}/more`,
    jsonBody({}),
    options,
  );
}

export function fetchComboSet(
  setId: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<ComboSet>> {
  return requestJson(
    ComboSetSchema,
    `/v1/combo/sets/${encodeURIComponent(setId)}`,
    {method: 'GET'},
    options,
  );
}

export function fetchComboSetHistory(
  options: JsonRequestOptions = {},
): Promise<ApiResult<z.infer<typeof ComboSetsSchema>>> {
  return requestJson(
    ComboSetsSchema,
    '/v1/combo/sets',
    {method: 'GET'},
    options,
  );
}

export function reportComboSentence(
  sentenceId: string,
  reason: ComboReportReason,
  note?: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<z.infer<typeof ComboReportSchema>>> {
  return requestJson(
    ComboReportSchema,
    `/v1/combo/sentences/${encodeURIComponent(sentenceId)}/reports`,
    jsonBody({reason, ...(note ? {note} : {})}),
    options,
  );
}
