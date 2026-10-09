/** Course list route: no params (F14). */
export type CourseListRouteParams = undefined;

export type CourseLevelsRouteParams = {
  courseSlug: string;
  title?: string;
};

export type LevelUnitsRouteParams = {
  levelId: string;
  title?: string;
};

export type UnitLessonsRouteParams = {
  unitId: string;
  title?: string;
};

/** PR 16: a unit's summative task. */
export type UnitSummativeTaskRouteParams = {
  unitId: string;
  title?: string;
};

/** The Courses tab holds only the course list. */
export type CoursesStackParamList = {
  CourseList: CourseListRouteParams;
};

/** Curriculum screens (registered on the root stack). */
export type CourseFlowParamList = {
  CourseLevels: CourseLevelsRouteParams;
  LevelUnits: LevelUnitsRouteParams;
  UnitLessons: UnitLessonsRouteParams;
  UnitSummativeTask: UnitSummativeTaskRouteParams;
};
