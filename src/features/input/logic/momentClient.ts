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

import {createRequestId} from '@core/api/requestId';
import {createTimeoutSignal} from '@core/api/timeout';

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
  intent: 'use' | 'describe';
  image_id?: string;
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

/** Upload + one provider call; the server's own limit is 60 s. */
export const IMAGE_ANALYZE_TIMEOUT_MS = 30_000;

export type AnalyzeImageOptions = CanonicalLessonClientOptions & {
  timeoutMs?: number;
  /** Reads the picked file into memory (test seam). */
  readImage?: (uri: string) => Promise<Blob>;
};

type FileFormData = {
  append(name: string, value: Blob, fileName: string): void;
};

async function readImageFile(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

/**
 * The global fetch is expo/fetch, which cannot send React Native's
 * `{uri, name, type}` file parts (it throws before any request), so the photo
 * goes up as a Blob read from the file.
 */
function imageAnalysisForm(
  image: PickedImage,
  sourceType: 'camera' | 'gallery',
  bytes: Blob,
): FormData {
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
  const type = image.type ?? 'image/jpeg';
  // Expo's FormData takes the file name as the third argument (RN types omit
  // it); without one the server reads the part as a field, not a file.
  (form as unknown as FileFormData).append(
    'image',
    bytes.slice(0, bytes.size, type),
    image.fileName ?? 'image.jpg',
  );
  return form;
}

/**
 * Upload one photo for analysis. The file itself is never kept on the device
 * by this call. A caller abort is `cancelled`; running past `timeoutMs` is
 * `IMAGE_ANALYZE_TIMEOUT` (retryable), and neither marks the app offline.
 */
export async function analyzeImage(
  image: PickedImage,
  sourceType: 'camera' | 'gallery',
  options: AnalyzeImageOptions = {},
): Promise<CanonicalLessonResult<ImageAnalysis>> {
  const {
    timeoutMs = IMAGE_ANALYZE_TIMEOUT_MS,
    readImage = readImageFile,
    ...clientOptions
  } = options;
  let bytes: Blob;
  try {
    bytes = await readImage(image.uri);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[api] photo not readable',
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
    }
    // The file on the device, not the network: never "offline".
    return {
      ok: false,
      kind: 'content-error',
      errorCode: 'IMAGE_UNREADABLE',
      message: 'The photo could not be read.',
      retryable: false,
    };
  }

  const timeout = createTimeoutSignal(timeoutMs, options.signal);

  let answered: Awaited<ReturnType<typeof send>>;
  try {
    answered = await send(
      '/api/v1/images/analyze',
      {method: 'POST', body: imageAnalysisForm(image, sourceType, bytes)},
      'IMAGE_NOT_FOUND',
      {...clientOptions, signal: timeout.signal},
    );
  } finally {
    timeout.cleanup();
  }

  if (!('body' in answered)) {
    if (answered.cancelled && timeout.timedOut()) {
      return {
        ok: false,
        kind: 'network-error',
        errorCode: 'IMAGE_ANALYZE_TIMEOUT',
        message: 'Image analysis timed out.',
        retryable: true,
      };
    }
    return answered;
  }
  const checked = bodyOf(answered, 'IMAGE_NOT_FOUND');
  if (!checked.ok) return checked;
  const parsed = ImageAnalysisSchema.safeParse(checked.value);
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

/** E4: whether the server accepts "Tả" moments right now (the capability, not a guess). */
export async function fetchDescribeCapability(
  options: CanonicalLessonClientOptions = {},
): Promise<boolean> {
  const answered = await send(
    '/v1/capabilities',
    {method: 'GET'},
    'CAPABILITY_NOT_FOUND',
    options,
  );
  if (!('body' in answered) || answered.status !== 200) return false;
  const parsed = z
    .object({
      capabilities: z.object({
        moments: z.object({describe: z.object({enabled: z.boolean()})}),
      }),
    })
    .safeParse(answered.body);
  return parsed.success
    ? parsed.data.capabilities.moments.describe.enabled
    : false;
}
