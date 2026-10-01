import type {OCRReviewRouteParams} from '@features/ocr';

import type {OCRSourceType} from '@core/api/types';

export type CreateMainRouteParams = undefined;
export type PasteTextRouteParams = {analyzeError?: string} | undefined;
export interface ImageCaptureRouteParams {
  sourceType: OCRSourceType;
}

export type CreateStackParamList = {
  CreateMain: CreateMainRouteParams;
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
};
