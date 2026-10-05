import type {NavigatorScreenParams} from '@react-navigation/native';

import type {
  AccountSwitchRouteParams,
  BootGateRouteParams,
  OnboardingRouteParams,
} from '@features/account';
import type {HomeStackParamList} from '@features/home';
import type {
  CreateStackParamList,
  ImageCaptureRouteParams,
  PasteTextRouteParams,
} from '@features/input';
import type {LessonsStackParamList} from '@features/lesson/library';
import type {
  CanonicalCatalogRouteParams,
  CanonicalLessonPlayerRouteParams,
  LessonCreationRouteParams,
} from '@features/lesson/player';
import type {OCRReviewRouteParams} from '@features/ocr';
import type {ProfileStackParamList} from '@features/profile';
import type {DailyReviewRouteParams} from '@features/review';
import type {
  ShadowingLessonPickerRouteParams,
  ShadowingSessionRouteParams,
  ShadowingSummaryRouteParams,
  SpeakingRoomRouteParams,
} from '@features/speaking';
import type {TodayRouteParams} from '@features/today';

export type {
  CreateStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
};

/** Each tab holds only its hub screen (plus Profile's settings pages). */
export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Create: NavigatorScreenParams<CreateStackParamList> | undefined;
  Lessons: NavigatorScreenParams<LessonsStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

/**
 * Root stack: the tabs plus every task flow, each registered exactly once.
 * Flow screens cover the tab bar, and back returns to the opening tab.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  BootGate: BootGateRouteParams;
  Onboarding: OnboardingRouteParams;
  AccountSwitch: AccountSwitchRouteParams;
  // Create-lesson flow
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
  LessonCreation: LessonCreationRouteParams;
  // Lessons
  CanonicalCatalog: CanonicalCatalogRouteParams;
  CanonicalLessonPlayer: CanonicalLessonPlayerRouteParams;
  // Practice
  DailyReview: DailyReviewRouteParams;
  Today: TodayRouteParams;
  SpeakingRoom: SpeakingRoomRouteParams;
  ShadowingLessonPicker: ShadowingLessonPickerRouteParams;
  ShadowingSession: ShadowingSessionRouteParams;
  ShadowingSummary: ShadowingSummaryRouteParams;
};
