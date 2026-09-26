import type {OCRSourceType} from '@shared/api/types';
import type {NavigatorScreenParams} from '@react-navigation/native';

export type LearningDetailParamList = {
  Practice:
    | {questions: any[]; title?: string}
    | {lessonId: string; sessionId: string; title?: string};
};

export type HomeStackParamList = {
  HomeMain: undefined;
  ContentLessonRuntime: {lessonId: string};
  CurriculumLesson: {lessonId: string};
  DailyReview: undefined;
  Today: undefined;
} & LearningDetailParamList;

export type CreateStackParamList = {
  CreateMain: undefined;
  YouTubeInput:
    | {
        fromHome?: boolean;
        url?: string;
        transcriptRequired?: string;
      }
    | undefined;
  YouTubeProcessing: {
    url: string;
    manualCues?: import('@shared/schemas/youtube-transcript-v1').RawCue[];
  };
  YouTubeLesson:
    | {
        lesson: import('@shared/schemas/youtube-transcript-v1').YouTubeTranscript;
        saveFailed?: boolean;
      }
    | {
        lessonId: string;
      };
  PasteText: {analyzeError?: string} | undefined;
  ImageCapture: {sourceType: OCRSourceType};
  OCRReview: {
    imageUri: string;
    fileName?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    sourceType: OCRSourceType;
    extractedText: string;
    warnings?: string[];
    analyzeError?: string;
  };
} & LearningDetailParamList;

export type LessonsStackParamList = {
  LessonsList: undefined;
  CurriculumLesson: {lessonId: string};
  UnifiedLessonGeneration: {
    jobId: string;
    confirmedText?: string;
    level?: string;
  };
  ContentLessonList: undefined;
  ContentLessonDetail: {lessonId: string};
  ContentLessonRuntime: {lessonId: string};
  SpeakingRoom: {sentenceText?: string} | undefined;
  SpeakingShadowing: undefined;
  Today: undefined;
  DailyReview: undefined;
} & LearningDetailParamList;

export type ProfileStackParamList = {
  ProfileMain: undefined;
  PrivacyNote: undefined;
  ProgressReport: undefined;
  FeatureStatus: undefined;
  TtsSpike: undefined;
  UnifiedLessonsPreview: undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Create: NavigatorScreenParams<CreateStackParamList> | undefined;
  Lessons: NavigatorScreenParams<LessonsStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  YouTubeHistory: undefined;
  YouTubeLesson: CreateStackParamList['YouTubeLesson'];
  BootGate: undefined;
  Onboarding: undefined;
} & LearningDetailParamList;
