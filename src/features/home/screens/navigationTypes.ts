import type {NavigatorScreenParams} from '@react-navigation/native';
import type {
  AccountSwitchRouteParams,
  BootGateRouteParams,
  OnboardingRouteParams,
} from '@features/account';
import type {ContentLessonRuntimeRouteParams} from '@features/lesson/packages';
import type {CurriculumLessonRouteParams} from '@features/lesson/player';
import type {LessonsStackParamList} from '@features/lesson/library';
import type {PracticeRouteParams} from '@features/practice';
import type {DailyReviewRouteParams} from '@features/review';
import type {ProfileStackParamList} from '@features/profile';
import type {TodayRouteParams} from '@features/today';
import type {
  YouTubeHistoryRouteParams,
  YouTubeLessonRouteParams,
} from '@features/youtube';
import type {CreateStackParamList} from '@features/input';

export type HomeMainRouteParams = undefined;

export type LearningDetailParamList = {
  Practice: PracticeRouteParams;
};

export type HomeStackParamList = {
  HomeMain: HomeMainRouteParams;
  ContentLessonRuntime: ContentLessonRuntimeRouteParams;
  CurriculumLesson: CurriculumLessonRouteParams;
  DailyReview: DailyReviewRouteParams;
  Today: TodayRouteParams;
} & LearningDetailParamList;

export type RootTabParamList = {
  Home: undefined;
  Create: NavigatorScreenParams<CreateStackParamList> | undefined;
  Lessons: NavigatorScreenParams<LessonsStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  YouTubeHistory: YouTubeHistoryRouteParams;
  YouTubeLesson: YouTubeLessonRouteParams;
  BootGate: BootGateRouteParams;
  Onboarding: OnboardingRouteParams;
  AccountSwitch: AccountSwitchRouteParams;
} & LearningDetailParamList;
