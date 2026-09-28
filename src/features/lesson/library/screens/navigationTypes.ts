import type {
  ContentLessonDetailRouteParams,
  ContentLessonListRouteParams,
  ContentLessonRuntimeRouteParams,
} from '@features/lesson/packages';
import type {
  CurriculumLessonRouteParams,
  UnifiedLessonGenerationRouteParams,
} from '@features/lesson/player';
import type {PracticeRouteParams} from '@features/practice';
import type {DailyReviewRouteParams} from '@features/review';
import type {
  SpeakingRoomRouteParams,
  SpeakingShadowingRouteParams,
} from '@features/speaking';
import type {TodayRouteParams} from '@features/today';

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
