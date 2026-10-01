import type {
  CanonicalCatalogRouteParams,
  CanonicalLessonPlayerRouteParams,
  LessonCreationRouteParams,
} from '@features/lesson/player';
import type {DailyReviewRouteParams} from '@features/review';
import type {
  SpeakingRoomRouteParams,
  SpeakingShadowingRouteParams,
} from '@features/speaking';
import type {TodayRouteParams} from '@features/today';

export type LessonsListRouteParams = undefined;

export type LessonsStackParamList = {
  LessonsList: LessonsListRouteParams;
  CanonicalCatalog: CanonicalCatalogRouteParams;
  CanonicalLessonPlayer: CanonicalLessonPlayerRouteParams;
  LessonCreation: LessonCreationRouteParams;
  SpeakingRoom: SpeakingRoomRouteParams;
  SpeakingShadowing: SpeakingShadowingRouteParams;
  Today: TodayRouteParams;
  DailyReview: DailyReviewRouteParams;
};
