import type {NavigatorScreenParams} from '@react-navigation/native';

import type {
  AccountSwitchRouteParams,
  BootGateRouteParams,
  OnboardingRouteParams,
} from '@features/account';
import type {CreateStackParamList} from '@features/input';
import type {LessonsStackParamList} from '@features/lesson/library';
import type {
  CanonicalCatalogRouteParams,
  CanonicalLessonPlayerRouteParams,
} from '@features/lesson/player';
import type {ProfileStackParamList} from '@features/profile';
import type {DailyReviewRouteParams} from '@features/review';
import type {
  ShadowingLessonPickerRouteParams,
  ShadowingSessionRouteParams,
  ShadowingSummaryRouteParams,
  SpeakingRoomRouteParams,
} from '@features/speaking';
import type {TodayRouteParams} from '@features/today';

export type HomeMainRouteParams = undefined;

export type HomeStackParamList = {
  HomeMain: HomeMainRouteParams;
  CanonicalCatalog: CanonicalCatalogRouteParams;
  CanonicalLessonPlayer: CanonicalLessonPlayerRouteParams;
  DailyReview: DailyReviewRouteParams;
  Today: TodayRouteParams;
  SpeakingRoom: SpeakingRoomRouteParams;
  ShadowingLessonPicker: ShadowingLessonPickerRouteParams;
  ShadowingSession: ShadowingSessionRouteParams;
  ShadowingSummary: ShadowingSummaryRouteParams;
};

export type RootTabParamList = {
  Home: undefined;
  Create: NavigatorScreenParams<CreateStackParamList> | undefined;
  Lessons: NavigatorScreenParams<LessonsStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  BootGate: BootGateRouteParams;
  Onboarding: OnboardingRouteParams;
  AccountSwitch: AccountSwitchRouteParams;
};
