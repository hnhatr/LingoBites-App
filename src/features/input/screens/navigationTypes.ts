import type {OCRReviewRouteParams} from '@features/ocr';

import type {OCRSourceType} from '@core/api/types';

export type CreateMainRouteParams = undefined;
export type PasteTextRouteParams = {analyzeError?: string} | undefined;
export interface ImageCaptureRouteParams {
  sourceType: OCRSourceType;
}

/** The Create tab holds only its hub; the input screens are a root flow. */
export type CreateStackParamList = {
  CreateMain: CreateMainRouteParams;
};

/** Create-lesson input flow screens (registered on the root stack). */
export type CreateFlowParamList = {
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
};
