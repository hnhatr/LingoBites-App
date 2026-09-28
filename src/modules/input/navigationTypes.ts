import type {NavigatorScreenParams} from '@react-navigation/native';
import type {
  AccountSwitchRouteParams,
  BootGateRouteParams,
  OnboardingRouteParams,
} from '@modules/account';
import type {ContentLessonRuntimeRouteParams} from '@modules/content';
import type {CurriculumLessonRouteParams} from '@modules/curriculumLesson';
import type {LessonsStackParamList} from '@modules/lesson';
import type {OCRReviewRouteParams} from '@modules/ocr';
import type {PracticeRouteParams} from '@modules/practice';
import type {DailyReviewRouteParams} from '@modules/review';
import type {ProfileStackParamList} from '@modules/settings';
import type {TodayRouteParams} from '@modules/today';
import type {
  YouTubeHistoryRouteParams,
  YouTubeInputRouteParams,
  YouTubeLessonRouteParams,
  YouTubeProcessingRouteParams,
} from '@modules/youtube';
import type {OCRSourceType} from '@shared/api/types';

export type HomeMainRouteParams = undefined;
export type CreateMainRouteParams = undefined;
export type PasteTextRouteParams = {analyzeError?: string} | undefined;
export interface ImageCaptureRouteParams {
  sourceType: OCRSourceType;
}

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
