import {fetchUnitLessons} from './courseClient';

/**
 * The lesson after `lessonId` in its unit (unit order), or null on the
 * unit's last lesson or when the unit cannot load. Served from the curriculum
 * cache offline, like the unit screen.
 */
export async function findNextUnitLesson(
  unitId: string,
  lessonId: string,
  fetchImpl?: typeof fetch,
): Promise<string | null> {
  const result = await fetchUnitLessons(unitId, {fetchImpl});
  if (!result.ok) return null;
  const index = result.value.findIndex(lesson => lesson.id === lessonId);
  if (index === -1) return null;
  return result.value[index + 1]?.id ?? null;
}
