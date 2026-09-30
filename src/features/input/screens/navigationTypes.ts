import type {LearningDetailParamList} from '@features/home';
import type {OCRReviewRouteParams} from '@features/ocr';
import type {
  YouTubeInputRouteParams,
  YouTubeLessonRouteParams,
  YouTubeProcessingRouteParams,
} from '@features/youtube';

import type {OCRSourceType} from '@core/api/types';

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
