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

/** Curriculum screens (registered on the root stack). */
export type CourseFlowParamList = {
  CourseList: CourseListRouteParams;
  CourseLevels: CourseLevelsRouteParams;
  LevelUnits: LevelUnitsRouteParams;
  UnitLessons: UnitLessonsRouteParams;
};
