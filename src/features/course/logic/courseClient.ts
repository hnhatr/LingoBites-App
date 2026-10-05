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
 */
import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';

const CourseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
});

const LevelSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
});

const UnitSchema = z.object({
  id: z.string(),
  levelId: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
});

const CurriculumLessonSchema = z.object({
  id: z.string(),
  unitId: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  estimatedMinutes: z.number().int().nullable(),
});

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

async function getList<T>(
  path: string,
  schema: z.ZodType<T>,
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
