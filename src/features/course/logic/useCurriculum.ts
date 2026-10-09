import {useCallback, useEffect, useRef, useState} from 'react';

import {
  type Course,
  type CourseClientError,
  type CourseLevel,
  type CourseResult,
  type CourseUnit,
  type CurriculumLesson,
  fetchCourseEntitlements,
  fetchCourseLevels,
  fetchCourses,
  fetchLevelUnits,
  fetchUnitLessons,
} from './courseClient';
import {
  countUnitProgress,
  readCompletedLessonIds,
  readPassedLessonIds,
  readSummativeState,
  type SummativeState,
  type UnitProgress,
} from './unitProgress';

export type CurriculumState<T> =
  | {status: 'loading'}
  | {status: 'ready'; data: T}
  | {status: 'error'; error: CourseClientError};

/**
 * Loads one curriculum list. `refresh` aborts the previous request, so a
 * screen re-focused while loading never shows a stale answer.
 */
function useCurriculumLoader<T>(
  load: (signal: AbortSignal) => Promise<CourseResult<T>>,
) {
  const [state, setState] = useState<CurriculumState<T>>({status: 'loading'});
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(previous =>
      previous.status === 'ready' ? previous : {status: 'loading'},
    );
    const result = await load(controller.signal);
    if (controller.signal.aborted) return;
    setState(
      result.ok
        ? {status: 'ready', data: result.value}
        : {status: 'error', error: result},
    );
  }, [load]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {state, refresh};
}

/** Published courses (Library "Khóa học" segment, course list screen). */
export type CourseWithAccess = Course & {unlocked: boolean};

export function useCourses() {
  const load = useCallback(
    async (signal: AbortSignal): Promise<CourseResult<CourseWithAccess[]>> => {
      const courses = await fetchCourses({signal});
      if (!courses.ok) return courses;
      const needsEntitlements = courses.value.some(course => course.isLocked);
      // A failed entitlement lookup keeps locked courses locked; it must not
      // hide the whole list.
      const entitled = needsEntitlements
        ? await fetchCourseEntitlements({signal})
        : null;
      const entitledIds = entitled?.ok ? entitled.value : [];
      return {
        ok: true,
        value: courses.value.map(course => ({
          ...course,
          unlocked: !course.isLocked || entitledIds.includes(course.id),
        })),
      };
    },
    [],
  );
  return useCurriculumLoader<CourseWithAccess[]>(load);
}

/** Levels of one course. */
export function useCourseLevels(courseSlug: string) {
  const load = useCallback(
    (signal: AbortSignal) => fetchCourseLevels(courseSlug, {signal}),
    [courseSlug],
  );
  return useCurriculumLoader<CourseLevel[]>(load);
}

export type UnitWithProgress = {
  unit: CourseUnit;
  /** Null when the unit's lessons could not be loaded. */
  progress: UnitProgress | null;
};

/**
 * Units of one level, each with its completed-lesson count. Lessons of every
 * unit load in parallel; one failed unit only hides its own progress bar.
 */
export function useLevelUnits(levelId: string) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<CourseResult<UnitWithProgress[]>> => {
      const units = await fetchLevelUnits(levelId, {signal});
      if (!units.ok) return units;
      const lessonLists = await Promise.all(
        units.value.map(unit => fetchUnitLessons(unit.id, {signal})),
      );
      const completedIds = readCompletedLessonIds();
      const passedIds = readPassedLessonIds();
      return {
        ok: true,
        value: units.value.map((unit, index) => {
          const lessons = lessonLists[index];
          return {
            unit,
            progress: lessons.ok
              ? countUnitProgress(
                  lessons.value.map(lesson => lesson.id),
                  completedIds,
                  passedIds,
                )
              : null,
          };
        }),
      };
    },
    [levelId],
  );
  return useCurriculumLoader<UnitWithProgress[]>(load);
}

export type UnitLessons = {
  lessons: CurriculumLesson[];
  completedIds: ReadonlySet<string>;
  /** Lessons the Server counts as passed (PR 16). */
  passedIds: ReadonlySet<string>;
  progress: UnitProgress;
  /** Whether the unit's summative task is open (decision B4). */
  summative: SummativeState;
};

/** Lessons of one unit plus which of them are completed on this device. */
export function useUnitLessons(unitId: string) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<CourseResult<UnitLessons>> => {
      const lessons = await fetchUnitLessons(unitId, {signal});
      if (!lessons.ok) return lessons;
      const completedIds = readCompletedLessonIds();
      const passedIds = readPassedLessonIds();
      const lessonIds = lessons.value.map(lesson => lesson.id);
      return {
        ok: true,
        value: {
          lessons: lessons.value,
          completedIds,
          passedIds,
          progress: countUnitProgress(lessonIds, completedIds, passedIds),
          summative: readSummativeState(unitId, lessonIds, completedIds),
        },
      };
    },
    [unitId],
  );
  return useCurriculumLoader<UnitLessons>(load);
}
