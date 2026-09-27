import type {NavigatorScreenParams} from '@react-navigation/native';
import type {
  BootGateRouteParams,
  OnboardingRouteParams,
} from '@modules/account';
import type {
  ContentLessonDetailRouteParams,
  ContentLessonListRouteParams,
  ContentLessonRuntimeRouteParams,
} from '@modules/content';
import type {
  CurriculumLessonRouteParams,
  UnifiedLessonGenerationRouteParams,
  UnifiedLessonsPreviewRouteParams,
} from '@modules/curriculumLesson';
import type {
  CreateMainRouteParams,
  HomeMainRouteParams,
  ImageCaptureRouteParams,
  PasteTextRouteParams,
} from '@modules/input';
import type {LessonsListRouteParams} from '@modules/lesson';
import type {OCRReviewRouteParams} from '@modules/ocr';
import type {PracticeRouteParams} from '@modules/practice';
import type {DailyReviewRouteParams} from '@modules/review';
import type {
  FeatureStatusRouteParams,
  PrivacyNoteRouteParams,
  ProfileMainRouteParams,
  ProgressReportRouteParams,
} from '@modules/settings';
import type {
  SpeakingRoomRouteParams,
  SpeakingShadowingRouteParams,
} from '@modules/speaking';
import type {TodayRouteParams} from '@modules/today';
import type {TtsSpikeRouteParams} from '@modules/tts';
import type {
  YouTubeHistoryRouteParams,
  YouTubeInputRouteParams,
  YouTubeLessonRouteParams,
  YouTubeProcessingRouteParams,
} from '@modules/youtube';

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

export type CreateStackParamList = {
  CreateMain: CreateMainRouteParams;
  YouTubeInput: YouTubeInputRouteParams;
  YouTubeProcessing: YouTubeProcessingRouteParams;
  YouTubeLesson: YouTubeLessonRouteParams;
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
} & LearningDetailParamList;

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

export type ProfileStackParamList = {
  ProfileMain: ProfileMainRouteParams;
  PrivacyNote: PrivacyNoteRouteParams;
  ProgressReport: ProgressReportRouteParams;
  FeatureStatus: FeatureStatusRouteParams;
  TtsSpike: TtsSpikeRouteParams;
  UnifiedLessonsPreview: UnifiedLessonsPreviewRouteParams;
};

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
} & LearningDetailParamList;
