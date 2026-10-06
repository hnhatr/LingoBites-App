import type {OCRReviewRouteParams} from '@features/ocr';

import type {OCRSourceType} from '@core/api/types';

export type CreateHubRouteParams = undefined;
export type PasteTextRouteParams = {analyzeError?: string} | undefined;
export interface ImageCaptureRouteParams {
  sourceType: OCRSourceType;
}

/** Create-lesson hub and input flow screens (registered on the root stack). */
export type CreateFlowParamList = {
  CreateHub: CreateHubRouteParams;
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
};
