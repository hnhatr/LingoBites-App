/**
 * E3: the App's calls for the everyday flow: photo analysis, starting a "use"
 * moment, confirming a typed situation, the situation catalogue, and the moments
 * still running. Built on the canonical client's send/errorFromStatus, so errors
 * look the same as the rest of the creation flow.
 */
import {Platform} from 'react-native';
import {z} from 'zod';

import {
  type CanonicalLessonClientOptions,
  type CanonicalLessonResult,
  contentError,
  errorFromStatus,
  send,
} from '@features/lesson/player';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {createRequestId} from '@core/api/requestId';

import type {PickedImage} from './imagePicker';

export const ImageAnalysisSchema = z
  .object({
    request_id: z.string(),
    status: z.literal('success'),
    image_id: z.string().uuid().nullable(),
    kind: z.enum(['text', 'mixed', 'scene']),
    text: z.string(),
    warnings: z.array(z.string()),
    pii_lines: z.array(
      z.object({
        line: z.number().int().min(1),
        type: z.enum(['phone', 'email', 'id_number']),
      }),
    ),
    suggested_intent: z.enum(['understand', 'describe']),
  })
  .strict();
export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;

export const SituationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title_vi: z.string(),
  title_en: z.string(),
  level_code: z.string(),
  goals: z.array(z.string()),
  interests: z.array(z.string()),
});
export type Situation = z.infer<typeof SituationSchema>;

const SituationsResponseSchema = z.object({
  situations: z.array(SituationSchema),
});

export const ActiveMomentsSchema = z.object({
  requests: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
      situation_vi: z.string().nullable(),
      confirm_expires_at: z.string().nullable(),
      lesson_id: z.string().uuid().nullable(),
    }),
  ),
});
export type ActiveMoment = z.infer<
  typeof ActiveMomentsSchema
>['requests'][number];

export type MomentStartBody = {
  intent: 'use';
  level?: 'A1' | 'A2';
  situation_id?: string;
  situation_note?: string;
  image_text?: string;
};

function bodyOf(
  answered: {status: number; body: unknown},
  notFound: string,
): CanonicalLessonResult<unknown> {
  if (answered.status < 200 || answered.status >= 300) {
    return errorFromStatus(answered.status, answered.body, notFound);
  }
  return {ok: true, value: answered.body};
}

/** Upload one photo for analysis. The file itself is never kept on the device by this call. */
export async function analyzeImage(
  image: PickedImage,
  sourceType: 'camera' | 'gallery',
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<ImageAnalysis>> {
  const {apiBaseUrl} = getAppConfig();
  const form = new FormData();
  form.append('request_id', createRequestId());
  form.append('source_type', sourceType);
  const platform =
    Platform.OS === 'ios'
      ? 'ios'
      : Platform.OS === 'android'
      ? 'android'
      : undefined;
  if (platform) form.append('platform', platform);
  if (image.width) form.append('image_width', String(image.width));
  if (image.height) form.append('image_height', String(image.height));
  form.append('image', {
    uri: image.uri,
    name: image.fileName ?? 'image.jpg',
    type: image.type ?? 'image/jpeg',
  } as unknown as Blob);

  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}/api/v1/images/analyze`,
      {
        method: 'POST',
        headers: {Accept: 'application/json'},
        body: form,
        signal: options.signal,
      },
      options.fetchImpl,
    );
  } catch {
    return {
      ok: false,
      kind: 'network-error',
      errorCode: 'NETWORK_ERROR',
      message: 'Mất kết nối. Thử lại khi có mạng.',
      retryable: true,
    };
  }
  const body = await response.json().catch(() => undefined);
  const answered = bodyOf({status: response.status, body}, 'IMAGE_NOT_FOUND');
  if (!answered.ok) return answered;
  const parsed = ImageAnalysisSchema.safeParse(answered.value);
  return parsed.success
    ? {ok: true, value: parsed.data}
    : contentError('Image analysis failed validation.');
}

/** Start a "use" moment. Returns the request id to follow. */
export async function submitMoment(
  body: MomentStartBody,
  idempotencyKey: string,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<{moment_request_id: string}>> {
  const answered = await send(
    '/api/v1/moments',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(body),
    },
    'SITUATION_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const checked = bodyOf(answered, 'SITUATION_NOT_FOUND');
  if (!checked.ok) return checked;
  const parsed = z
    .object({moment_request_id: z.string().uuid()})
    .safeParse(checked.value);
  return parsed.success
    ? {ok: true, value: parsed.data}
    : contentError('Moment response failed validation.');
}

/** Accept or reject the situation the AI understood. */
export async function confirmMoment(
  requestId: string,
  accept: boolean,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<void>> {
  const answered = await send(
    `/api/v1/lesson-creations/${encodeURIComponent(requestId)}/confirm`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({accept}),
    },
    'CREATION_REQUEST_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const checked = bodyOf(answered, 'CREATION_REQUEST_NOT_FOUND');
  return checked.ok ? {ok: true, value: undefined} : checked;
}

/** Situations the learner may choose, for the level (server applies the age group). */
export async function fetchSituations(
  level: 'A1' | 'A2' | undefined,
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<Situation[]>> {
  const query = level ? `?level=${level}` : '';
  const answered = await send(
    `/api/v1/situations${query}`,
    {method: 'GET'},
    'SITUATION_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const checked = bodyOf(answered, 'SITUATION_NOT_FOUND');
  if (!checked.ok) return checked;
  const parsed = SituationsResponseSchema.safeParse(checked.value);
  return parsed.success
    ? {ok: true, value: parsed.data.situations}
    : contentError('Situations failed validation.');
}

/** The learner's moments still running or waiting for confirmation (after the app reopened). */
export async function fetchActiveMoments(
  options: CanonicalLessonClientOptions = {},
): Promise<CanonicalLessonResult<ActiveMoment[]>> {
  const answered = await send(
    '/api/v1/lesson-creations?kind=moment&active=true',
    {method: 'GET'},
    'CREATION_REQUEST_NOT_FOUND',
    options,
  );
  if (!('body' in answered)) return answered;
  const checked = bodyOf(answered, 'CREATION_REQUEST_NOT_FOUND');
  if (!checked.ok) return checked;
  const parsed = ActiveMomentsSchema.safeParse(checked.value);
  return parsed.success
    ? {ok: true, value: parsed.data.requests}
    : contentError('Active moments failed validation.');
}
