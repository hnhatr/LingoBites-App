/**
 * CurriculumLesson selection adapter: real published-lesson selection for
 * TASK-008, built only on the existing public hierarchy metadata routes.
 *
 * Chain (all Server-owned, read-only, no new catalog API):
 * `GET /v1/courses` → `GET /v1/courses/:courseSlug/levels` →
 * `GET /v1/levels/:levelId/units` → `GET /v1/units/:unitId/lessons`.
 * Every hop lists published records with published ancestors; the walk
 * collects every published lesson so the Lessons shell can surface a real
 * selectable `lessonId` for the `CurriculumLesson` route. Nothing here is
 * persisted and no Lesson V2 symbol is touched (AD-005).
 */
import {authenticatedFetch} from '@shared/api/authenticatedFetch';
import {getAppConfig} from '@shared/api/appConfig';
import {z} from 'zod';

const COURSES_PATH = '/v1/courses';
const LEVELS_BY_COURSE_PATH = '/v1/courses';
const UNITS_BY_LEVEL_PATH = '/v1/levels';
const LESSONS_BY_UNIT_PATH = '/v1/units';

const CurriculumStatusSchema = z.enum(['draft', 'published', 'archived']);

const PublishedCourseSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    sourceLanguage: z.string(),
    targetLanguage: z.string(),
    status: CurriculumStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const PublishedLevelSchema = z
  .object({
    id: z.string().uuid(),
    courseId: z.string().uuid(),
    code: z.string(),
    title: z.string(),
    description: z.string(),
    position: z.number().int(),
    status: CurriculumStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const PublishedUnitSchema = z
  .object({
    id: z.string().uuid(),
    levelId: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    position: z.number().int(),
    status: CurriculumStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const PublishedLessonMetadataSchema = z
  .object({
    id: z.string().uuid(),
    unitId: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    position: z.number().int(),
    estimatedMinutes: z.number().int().nullable(),
    status: CurriculumStatusSchema,
    publishedAt: z.string().nullable(),
    contentRevision: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const CourseListEnvelopeSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  courses: z.array(PublishedCourseSchema),
});

const LevelListEnvelopeSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  levels: z.array(PublishedLevelSchema),
});

const UnitListEnvelopeSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  units: z.array(PublishedUnitSchema),
});

const LessonListEnvelopeSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  lessons: z.array(PublishedLessonMetadataSchema),
});

export type CurriculumLessonSelectionItem = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number | null;
  courseTitle: string;
  levelTitle: string;
  unitTitle: string;
};

export type CurriculumLessonSelectionResult =
  | {ok: true; lessons: CurriculumLessonSelectionItem[]}
  | {ok: false; reason: 'cancelled'};

export type CurriculumLessonSelectionOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function getMetadataList<T>(
  path: string,
  schema: z.ZodType<T>,
  options: CurriculumLessonSelectionOptions,
): Promise<T | null> {
  if (options.signal?.aborted) {
    return null;
  }
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
    if (isAbortError(error) || options.signal?.aborted) {
      throw error;
    }
    return null;
  }
  if (response.status < 200 || response.status >= 300) {
    return null;
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/**
 * Walk the existing published hierarchy and collect every published
 * lesson. A failed or malformed hop degrades to an empty subtree — never
 * a throw, never a partial crash — so the Lessons shell stays usable when
 * the catalog is empty or unreachable. Pass-through order follows the
 * Server's published ordering (position ascending within each level).
 */
export async function fetchPublishedCurriculumLessons(
  options: CurriculumLessonSelectionOptions = {},
): Promise<CurriculumLessonSelectionResult> {
  try {
    const coursesEnvelope = await getMetadataList(
      COURSES_PATH,
      CourseListEnvelopeSchema,
      options,
    );
    if (!coursesEnvelope) {
      if (options.signal?.aborted) {
        return {ok: false, reason: 'cancelled'};
      }
      return {ok: true, lessons: []};
    }
    const lessons: CurriculumLessonSelectionItem[] = [];
    const courses = [...coursesEnvelope.courses].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    const levelLists = await Promise.all(
      courses.map(course =>
        getMetadataList(
          `${LEVELS_BY_COURSE_PATH}/${encodeURIComponent(course.slug)}/levels`,
          LevelListEnvelopeSchema,
          options,
        ).then(levels => ({course, levels})),
      ),
    );
    for (const {course, levels} of levelLists) {
      if (!levels) {
        continue;
      }
      const orderedLevels = [...levels.levels].sort(
        (a, b) => a.position - b.position,
      );
      const unitLists = await Promise.all(
        orderedLevels.map(level =>
          getMetadataList(
            `${UNITS_BY_LEVEL_PATH}/${encodeURIComponent(level.id)}/units`,
            UnitListEnvelopeSchema,
            options,
          ).then(units => ({level, units})),
        ),
      );
      for (const {level, units} of unitLists) {
        if (!units) {
          continue;
        }
        const orderedUnits = [...units.units].sort(
          (a, b) => a.position - b.position,
        );
        const lessonLists = await Promise.all(
          orderedUnits.map(unit =>
            getMetadataList(
              `${LESSONS_BY_UNIT_PATH}/${encodeURIComponent(unit.id)}/lessons`,
              LessonListEnvelopeSchema,
              options,
            ).then(entries => ({unit, entries})),
          ),
        );
        for (const {unit, entries} of lessonLists) {
          if (!entries) {
            continue;
          }
          const ordered = [...entries.lessons].sort(
            (a, b) => a.position - b.position,
          );
          for (const entry of ordered) {
            lessons.push({
              id: entry.id,
              title: entry.title,
              description: entry.description,
              estimatedMinutes: entry.estimatedMinutes,
              courseTitle: course.title,
              levelTitle: level.title,
              unitTitle: unit.title,
            });
          }
        }
      }
    }
    return {ok: true, lessons};
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) {
      return {ok: false, reason: 'cancelled'};
    }
    return {ok: true, lessons: []};
  }
}
