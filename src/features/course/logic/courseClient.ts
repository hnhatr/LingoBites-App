/**
 * Structured-curriculum API client (F14): Course → Level → Unit → Lesson.
 *
 * Follows the per-domain convention of `canonicalLessonClient.ts`
 * (`authenticatedFetch`, `getAppConfig`, injected `fetchImpl`, `AbortSignal`).
 * Exact public routes, which only return published rows with published
 * ancestors:
 * `GET /v1/courses`, `GET /v1/courses/:courseSlug/levels`,
 * `GET /v1/levels/:levelId/units`, `GET /v1/units/:unitId/lessons`.
 *
 * A curriculum lesson id is the same id `GET /api/v1/lessons/:id` serves (one
 * `lessons` table on the Server), so a lesson row opens the regular player.
 *
 * Offline mode (docs/architecture/offline-mode.md #17, #19): every validated
 * answer is kept in `app_settings`; when the network fails the last one is
 * served again, so curriculum screens open offline after one visit. The
 * signed-in user's entitlements are kept per account.
 */
import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {getDatabase} from '@core/db/database';
import {
  type UnitSummativeTask,
  UnitSummativeTaskResponseSchema,
} from '@core/schemas/lesson';

const CourseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  /** Paid course: needs an entitlement for the signed-in user. */
  isLocked: z.boolean().default(false),
  productId: z.string().nullable().default(null),
  priceAmount: z.number().int().nullable().default(null),
  priceCurrency: z.string().nullable().default(null),
});

const LevelSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
});

const AudienceSchema = z.enum(['all', 'kids', 'adults']);

const UnitSchema = z.object({
  id: z.string(),
  levelId: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  /** What the learner can do after the unit; absent on older servers. */
  canDo: z.array(z.string()).default([]),
  audience: AudienceSchema.default('all'),
});

const CurriculumLessonSchema = z.object({
  id: z.string(),
  unitId: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  estimatedMinutes: z.number().int().nullable(),
  /** What the learner can do after the lesson; absent on older servers. */
  canDo: z.array(z.string()).default([]),
  audience: AudienceSchema.default('all'),
});

const EntitlementsResponseSchema = z.object({course_ids: z.array(z.string())});
const CourseListResponseSchema = z.object({courses: z.array(CourseSchema)});
const LevelListResponseSchema = z.object({levels: z.array(LevelSchema)});
const UnitListResponseSchema = z.object({units: z.array(UnitSchema)});
const CurriculumLessonListResponseSchema = z.object({
  lessons: z.array(CurriculumLessonSchema),
});

export type Course = z.infer<typeof CourseSchema>;
export type CourseLevel = z.infer<typeof LevelSchema>;
export type CourseUnit = z.infer<typeof UnitSchema>;
export type CurriculumLesson = z.infer<typeof CurriculumLessonSchema>;

export type CourseClientError = {
  ok: false;
  kind: 'network-error' | 'server-error' | 'content-error';
  message: string;
  cancelled?: boolean;
  status?: number;
};

export type CourseResult<T> = {ok: true; value: T} | CourseClientError;

export type CourseClientOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const CACHE_PREFIX = 'curriculum_cache.';

/** `app_settings` key for one route; `/v1/me/…` answers belong to an account. */
function cacheKey(path: string): string | null {
  if (!path.startsWith('/v1/me/')) return `${CACHE_PREFIX}${path}`;
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        'current_account_id',
      ])
      .rows?.item(0) as {value?: string} | undefined;
    return row?.value ? `${CACHE_PREFIX}${row.value}${path}` : null;
  } catch {
    return null;
  }
}

function readCached<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): T | null {
  const key = cacheKey(path);
  if (!key) return null;
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
      .rows?.item(0) as {value?: string} | undefined;
    if (!row?.value) return null;
    const parsed = schema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCached(path: string, body: unknown): void {
  const key = cacheKey(path);
  if (!key) return;
  try {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [key, JSON.stringify(body), new Date().toISOString()],
    );
  } catch {
    // Only the offline copy is lost.
  }
}

async function getList<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: CourseClientOptions,
): Promise<CourseResult<T>> {
  const cancelled: CourseClientError = {
    ok: false,
    kind: 'network-error',
    message: 'Request cancelled.',
    cancelled: true,
  };
  if (options.signal?.aborted) return cancelled;
  const {apiBaseUrl} = getAppConfig();
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${apiBaseUrl}${path}`,
      {
        method: 'GET',
        headers: {Accept: 'application/json'},
        signal: options.signal,
      },
      options.fetchImpl,
    );
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) return cancelled;
    const cached = readCached(path, schema);
    if (cached !== null) return {ok: true, value: cached};
    return {
      ok: false,
      kind: 'network-error',
      message: 'Network connection lost.',
    };
  }
  const body = await readJson(response);
  if (response.status < 200 || response.status >= 300) {
    return {
      ok: false,
      kind: 'server-error',
      message: 'Request failed.',
      status: response.status,
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'content-error',
      message: 'Curriculum response failed validation.',
    };
  }
  writeCached(path, body);
  return {ok: true, value: parsed.data};
}

function byPosition<T extends {position: number}>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/** Published courses. */
export async function fetchCourses(
  options: CourseClientOptions = {},
): Promise<CourseResult<Course[]>> {
  const result = await getList(
    '/v1/courses',
    CourseListResponseSchema,
    options,
  );
  return result.ok ? {ok: true, value: result.value.courses} : result;
}

/** Ids of locked courses the signed-in user has unlocked. */
export async function fetchCourseEntitlements(
  options: CourseClientOptions = {},
): Promise<CourseResult<string[]>> {
  const result = await getList(
    '/v1/me/course-entitlements',
    EntitlementsResponseSchema,
    options,
  );
  return result.ok ? {ok: true, value: result.value.course_ids} : result;
}

/** Published levels of one course, in course order. */
export async function fetchCourseLevels(
  courseSlug: string,
  options: CourseClientOptions = {},
): Promise<CourseResult<CourseLevel[]>> {
  const result = await getList(
    `/v1/courses/${encodeURIComponent(courseSlug)}/levels`,
    LevelListResponseSchema,
    options,
  );
  return result.ok
    ? {ok: true, value: byPosition(result.value.levels)}
    : result;
}

/** Published units of one level, in level order. */
export async function fetchLevelUnits(
  levelId: string,
  options: CourseClientOptions = {},
): Promise<CourseResult<CourseUnit[]>> {
  const result = await getList(
    `/v1/levels/${encodeURIComponent(levelId)}/units`,
    UnitListResponseSchema,
    options,
  );
  return result.ok ? {ok: true, value: byPosition(result.value.units)} : result;
}

/** Published lessons of one unit, in unit order. */
export async function fetchUnitLessons(
  unitId: string,
  options: CourseClientOptions = {},
): Promise<CourseResult<CurriculumLesson[]>> {
  const result = await getList(
    `/v1/units/${encodeURIComponent(unitId)}/lessons`,
    CurriculumLessonListResponseSchema,
    options,
  );
  return result.ok
    ? {ok: true, value: byPosition(result.value.lessons)}
    : result;
}

/** PR 16: the unit's summative task, or null when the unit has none. */
export async function fetchUnitSummativeTask(
  unitId: string,
  options: CourseClientOptions = {},
): Promise<CourseResult<UnitSummativeTask | null>> {
  const result = await getList(
    `/v1/units/${encodeURIComponent(unitId)}/summative-task`,
    UnitSummativeTaskResponseSchema,
    options,
  );
  return result.ok ? {ok: true, value: result.value.task} : result;
}
