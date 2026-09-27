import type {
  ContentLessonDetailRouteParams,
  ContentLessonListRouteParams,
  ContentLessonRuntimeRouteParams,
} from '@modules/content';
import type {
  CurriculumLessonRouteParams,
  UnifiedLessonGenerationRouteParams,
} from '@modules/curriculumLesson';
import type {PracticeRouteParams} from '@modules/practice';
import type {DailyReviewRouteParams} from '@modules/review';
import type {
  SpeakingRoomRouteParams,
  SpeakingShadowingRouteParams,
} from '@modules/speaking';
import type {TodayRouteParams} from '@modules/today';

export type LessonsListRouteParams = undefined;

export type LearningDetailParamList = {
  Practice: PracticeRouteParams;
};

export type LessonsStackParamList = {
  LessonsList: LessonsListRouteParams;
  CurriculumLesson: CurriculumLessonRouteParams;
  UnifiedLessonGeneration: UnifiedLessonGenerationRouteParams;
  ContentLessonList: ContentLessonListRouteParams;
  ContentLessonDetail: ContentLessonDetailRouteParams;
  ContentLessonRuntime: ContentLessonRuntimeRouteParams;
  SpeakingRoom: SpeakingRoomRouteParams;
  SpeakingShadowing: SpeakingShadowingRouteParams;
  Today: TodayRouteParams;
  DailyReview: DailyReviewRouteParams;
} & LearningDetailParamList;
