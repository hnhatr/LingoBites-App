import type {NavigatorScreenParams} from '@react-navigation/native';

import type {
  AccountSwitchRouteParams,
  BootGateRouteParams,
  OnboardingRouteParams,
} from '@features/account';
import type {
  CourseLevelsRouteParams,
  CoursesStackParamList,
  LevelUnitsRouteParams,
  UnitLessonsRouteParams,
  UnitSummativeTaskRouteParams,
} from '@features/course';
import type {HomeStackParamList} from '@features/home';
import type {
  CreateHubRouteParams,
  ImageCaptureRouteParams,
  MomentReviewRouteParams,
  PasteTextRouteParams,
  SituationInputRouteParams,
} from '@features/input';
import type {
  LessonsStackParamList,
  LibraryListRouteParams,
  VideoHubRouteParams,
} from '@features/lesson/library';
import type {
  CanonicalCatalogRouteParams,
  CanonicalLessonPlayerRouteParams,
  LessonCreationRouteParams,
  LessonFlowPlayerRouteParams,
} from '@features/lesson/player';
import type {OCRReviewRouteParams} from '@features/ocr';
import type {
  LearnerOnboardingRouteParams,
  LearningProfileRouteParams,
  PlacementResultRouteParams,
  PlacementTestRouteParams,
} from '@features/onboarding';
import type {PracticeRouteParams} from '@features/practice';
import type {ProfileStackParamList} from '@features/profile';
import type {
  DailyReviewRouteParams,
  ItemReviewRouteParams,
} from '@features/review';
import type {
  ShadowingLessonPickerRouteParams,
  ShadowingSessionRouteParams,
  ShadowingSummaryRouteParams,
  SpeakingRoomRouteParams,
} from '@features/speaking';
import type {TodayRouteParams} from '@features/today';

export type {
  CoursesStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
};

/** Each tab holds only its hub screen (plus Profile's settings pages). */
export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Courses: NavigatorScreenParams<CoursesStackParamList> | undefined;
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
  // Phase 2: learner profile and placement test
  LearnerOnboarding: LearnerOnboardingRouteParams;
  LearningProfile: LearningProfileRouteParams;
  PlacementTest: PlacementTestRouteParams;
  PlacementResult: PlacementResultRouteParams;
  // Create-lesson flow
  CreateHub: CreateHubRouteParams;
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
  MomentReview: MomentReviewRouteParams;
  SituationInput: SituationInputRouteParams;
  LessonCreation: LessonCreationRouteParams;
  // Lessons
  CanonicalCatalog: CanonicalCatalogRouteParams;
  CanonicalLessonPlayer: CanonicalLessonPlayerRouteParams;
  LessonFlowPlayer: LessonFlowPlayerRouteParams;
  LibraryList: LibraryListRouteParams;
  VideoHub: VideoHubRouteParams;
  // Structured curriculum (Course → Level → Unit → Lesson)
  CourseLevels: CourseLevelsRouteParams;
  LevelUnits: LevelUnitsRouteParams;
  UnitLessons: UnitLessonsRouteParams;
  UnitSummativeTask: UnitSummativeTaskRouteParams;
  // Practice
  DailyReview: DailyReviewRouteParams;
  ItemReview: ItemReviewRouteParams;
  Practice: PracticeRouteParams;
  Today: TodayRouteParams;
  SpeakingRoom: SpeakingRoomRouteParams;
  ShadowingLessonPicker: ShadowingLessonPickerRouteParams;
  ShadowingSession: ShadowingSessionRouteParams;
  ShadowingSummary: ShadowingSummaryRouteParams;
};
