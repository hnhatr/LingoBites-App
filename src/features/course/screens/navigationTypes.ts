/** Course list route: no params (F14). */
export type CourseListRouteParams = undefined;

export type CourseLevelsRouteParams = {
  courseSlug: string;
  title?: string;
  /** The level whose units are shown; the first level when unset. */
  levelId?: string;
  /** The shown level's code (e.g. A1), for the breadcrumb of deeper screens. */
  levelCode?: string;
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

/**
 * The Courses tab: the course list, then the curriculum screens, so the tab
 * bar stays while the learner browses (lessons open above it).
 */
export type CoursesStackParamList = {
  CourseList: CourseListRouteParams;
  CourseLevels: CourseLevelsRouteParams;
  LevelUnits: LevelUnitsRouteParams;
  UnitLessons: UnitLessonsRouteParams;
  UnitSummativeTask: UnitSummativeTaskRouteParams;
};

/** Curriculum screens (registered in the Courses tab's stack). */
export type CourseFlowParamList = CoursesStackParamList;
