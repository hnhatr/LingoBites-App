/**
 * Unified lesson catalog client: `GET /api/v1/lessons`.
 *
 * Mirrors the Server `LessonCatalogSuccessResponseSchema` from
 * LingoBites-Server `src/modules/curriculum/lessonDelivery/model/`
 * (TASK-003). Summaries only — no origin discriminator, no answer keys,
 * no owner fields. Follows the `curriculumLessonClient` conventions
 * (`authenticatedFetch`, `getAppConfig`, injected `fetchImpl`,
 * `AbortSignal`).
 */
import {authenticatedFetch} from '@shared/api/authenticatedFetch';
import {getAppConfig} from '@shared/api/appConfig';
import {z} from 'zod';

export const LESSON_CATALOG_LIMIT_MIN = 1;
export const LESSON_CATALOG_LIMIT_MAX = 100;
export const LESSON_CATALOG_LIMIT_DEFAULT = 20;

export const UnifiedLessonSummarySchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    estimatedMinutes: z.number().int().nullable(),
    contentRevision: z.number().int(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const UnifiedLessonCatalogResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  lessons: z.array(UnifiedLessonSummarySchema),
  next_cursor: z.string().nullable(),
});

export type UnifiedLessonSummary = z.infer<typeof UnifiedLessonSummarySchema>;

export type LessonCatalogErrorKind =
  | 'auth-error'
  | 'network-error'
  | 'server-error'
  | 'content-error';

export type LessonCatalogError = {
  ok: false;
  kind: LessonCatalogErrorKind;
  errorCode: string;
  message: string;
  retryable: boolean;
  cancelled?: boolean;
  status?: number;
};

export type LessonCatalogResult =
  | {
      ok: true;
      requestId: string;
      lessons: UnifiedLessonSummary[];
      nextCursor: string | null;
    }
  | LessonCatalogError;

export type LessonCatalogClientOptions = {
  limit?: number;
  cursor?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function cancelledError(): LessonCatalogError {
  return {
    ok: false,
    kind: 'network-error',
    errorCode: 'CANCELLED',
    message: 'Request cancelled.',
    retryable: false,
    cancelled: true,
  };
}

/**
 * Load one page of the unified lesson catalog. Mixed origins arrive as
 * one flat summary list — the client never groups or branches by origin.
 */
export async function fetchLessonCatalogPage(
  options: LessonCatalogClientOptions = {},
): Promise<LessonCatalogResult> {
  if (options.signal?.aborted) return cancelledError();
  const limit = options.limit ?? LESSON_CATALOG_LIMIT_DEFAULT;
  if (
    !Number.isInteger(limit) ||
    limit < LESSON_CATALOG_LIMIT_MIN ||
    limit > LESSON_CATALOG_LIMIT_MAX
  ) {
    return {
      ok: false,
      kind: 'content-error',
      errorCode: 'INVALID_CATALOG_LIMIT',
      message: 'Catalog limit is out of range.',
      retryable: false,
    };
  }
  const {apiBaseUrl} = getAppConfig();
  const query = new URLSearchParams({limit: String(limit)});
  if (options.cursor) query.set('cursor', options.cursor);
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}/api/v1/lessons?${query.toString()}`,
      {
        method: 'GET',
        headers: {Accept: 'application/json'},
        signal: options.signal,
      },
      options.fetchImpl,
    );
  } catch (error) {
    return isAbortError(error) || options.signal?.aborted
      ? cancelledError()
      : {
          ok: false,
          kind: 'network-error',
          errorCode: 'NETWORK_ERROR',
          message: 'Network connection lost.',
          retryable: true,
        };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      kind: 'auth-error',
      errorCode: 'UNAUTHENTICATED',
      message: 'Sign in again to load lessons.',
      retryable: false,
      status: response.status,
    };
  }
  if (response.status < 200 || response.status >= 300) {
    return {
      ok: false,
      kind: 'server-error',
      errorCode: `HTTP_${response.status}`,
      message: 'Could not load lessons.',
      retryable: response.status >= 500 || response.status === 429,
      status: response.status,
    };
  }
  const parsed = UnifiedLessonCatalogResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'content-error',
      errorCode: 'INVALID_RESPONSE',
      message: 'Server returned an invalid lesson list.',
      retryable: false,
      status: response.status,
    };
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    lessons: parsed.data.lessons,
    nextCursor: parsed.data.next_cursor,
  };
}
