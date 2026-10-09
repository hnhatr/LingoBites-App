/**
 * Phase 2 (P2.4): onboarding profile and placement test API.
 *
 * `GET /v1/me/learner-profile` (404 until onboarding is done),
 * `PUT /v1/me/learner-profile`, `GET /v1/placement/test`,
 * `POST /v1/placement/submit`. Follows `courseClient.ts`
 * (`authenticatedFetch`, `getAppConfig`, injected `fetchImpl`).
 */
import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';

import {
  AGE_GROUPS,
  type LearnerProfileInput,
  LEVEL_CODES,
} from './profileOptions';

const PlacementScoreSchema = z.object({
  a1: z.number().int(),
  a2: z.number().int(),
  total: z.number().int(),
  max: z.number().int(),
});

const ServerProfileSchema = z.object({
  age_group: z.enum(AGE_GROUPS),
  level_code: z.string(),
  goals: z.array(z.string()),
  interests: z.array(z.string()),
  daily_minutes: z.number().int(),
  placement: z
    .object({
      score: PlacementScoreSchema,
      suggested_level: z.enum(LEVEL_CODES),
      taken_at: z.string(),
    })
    .nullable(),
});

const ProfileResponseSchema = z.object({profile: ServerProfileSchema});

const PlacementTestResponseSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      level: z.string(),
      prompt_vi: z.string(),
      prompt_en: z.string(),
      options: z.array(z.object({id: z.string(), text: z.string()})).min(2),
    }),
  ),
});

const PlacementSubmitResponseSchema = z.object({
  suggested_level: z.enum(LEVEL_CODES),
  score: PlacementScoreSchema,
  saved: z.boolean(),
});

export type ServerLearnerProfile = z.infer<typeof ServerProfileSchema>;
export type PlacementScore = z.infer<typeof PlacementScoreSchema>;
export type PlacementQuestion = z.infer<
  typeof PlacementTestResponseSchema
>['questions'][number];
export type PlacementResult = z.infer<typeof PlacementSubmitResponseSchema>;

export type ProfileClientError = {
  ok: false;
  kind: 'network-error' | 'server-error' | 'content-error';
  status?: number;
};
export type ProfileResult<T> = {ok: true; value: T} | ProfileClientError;

export type ProfileClientOptions = {fetchImpl?: typeof fetch};

async function request<T>(
  method: 'GET' | 'PUT' | 'POST',
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  body: unknown,
  options: ProfileClientOptions,
): Promise<ProfileResult<T>> {
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${path}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? {'Content-Type': 'application/json'} : {}),
        },
        ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
      },
      options.fetchImpl,
    );
  } catch {
    return {ok: false, kind: 'network-error'};
  }
  if (!response.ok) {
    return {ok: false, kind: 'server-error', status: response.status};
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return {ok: false, kind: 'content-error'};
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? {ok: true, value: parsed.data}
    : {ok: false, kind: 'content-error'};
}

/** The saved profile, or `null` when the learner has not onboarded yet. */
export async function fetchLearnerProfile(
  options: ProfileClientOptions = {},
): Promise<ProfileResult<ServerLearnerProfile | null>> {
  const result = await request(
    'GET',
    '/v1/me/learner-profile',
    ProfileResponseSchema,
    undefined,
    options,
  );
  if (result.ok) return {ok: true, value: result.value.profile};
  return result.kind === 'server-error' && result.status === 404
    ? {ok: true, value: null}
    : result;
}

export async function putLearnerProfile(
  input: LearnerProfileInput,
  options: ProfileClientOptions = {},
): Promise<ProfileResult<ServerLearnerProfile>> {
  const result = await request(
    'PUT',
    '/v1/me/learner-profile',
    ProfileResponseSchema,
    {
      age_group: input.ageGroup,
      level_code: input.levelCode,
      goals: input.goals,
      interests: input.interests,
      daily_minutes: input.dailyMinutes,
    },
    options,
  );
  return result.ok ? {ok: true, value: result.value.profile} : result;
}

export async function fetchPlacementTest(
  options: ProfileClientOptions = {},
): Promise<ProfileResult<PlacementQuestion[]>> {
  const result = await request(
    'GET',
    '/v1/placement/test',
    PlacementTestResponseSchema,
    undefined,
    options,
  );
  return result.ok ? {ok: true, value: result.value.questions} : result;
}

export async function submitPlacement(
  answers: Array<{questionId: string; optionId: string}>,
  options: ProfileClientOptions = {},
): Promise<ProfileResult<PlacementResult>> {
  return request(
    'POST',
    '/v1/placement/submit',
    PlacementSubmitResponseSchema,
    {
      answers: answers.map(answer => ({
        question_id: answer.questionId,
        option_id: answer.optionId,
      })),
    },
    options,
  );
}
