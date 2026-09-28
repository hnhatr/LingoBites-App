import type {
  YouTubeInputRouteParams,
  YouTubeProcessingRouteParams,
  YouTubeLessonRouteParams,
} from '@features/youtube';
import type {OCRReviewRouteParams} from '@features/ocr';
import type {OCRSourceType} from '@shared/api/types';
import type {LearningDetailParamList} from '@features/home';

export type CreateMainRouteParams = undefined;
export type PasteTextRouteParams = {analyzeError?: string} | undefined;
export interface ImageCaptureRouteParams {
  sourceType: OCRSourceType;
}

export type CreateStackParamList = {
  CreateMain: CreateMainRouteParams;
  YouTubeInput: YouTubeInputRouteParams;
  YouTubeProcessing: YouTubeProcessingRouteParams;
  YouTubeLesson: YouTubeLessonRouteParams;
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
} & LearningDetailParamList;
