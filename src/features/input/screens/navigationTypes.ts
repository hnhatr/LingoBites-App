import type {OCRReviewRouteParams} from '@features/ocr';

import type {OCRSourceType} from '@core/api/types';

import type {PickedImage} from '../logic/imagePicker';
import type {ImageAnalysis} from '../logic/momentClient';

export type CreateHubRouteParams = undefined;
export type PasteTextRouteParams = {analyzeError?: string} | undefined;
export interface ImageCaptureRouteParams {
  sourceType: OCRSourceType;
}

/** E3: the analysed photo and what the server found, before the learner chooses what to do. */
export interface MomentReviewRouteParams {
  sourceType: OCRSourceType;
  image: PickedImage;
  analysis: ImageAnalysis;
}

/** E3: pick or type a situation. `imageText` is text the learner confirmed from a photo. */
export type SituationInputRouteParams =
  | {imageText?: string; imageId?: string; requestId?: string}
  | undefined;

/** Create-lesson hub and input flow screens (registered on the root stack). */
export type CreateFlowParamList = {
  CreateHub: CreateHubRouteParams;
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  OCRReview: OCRReviewRouteParams;
  MomentReview: MomentReviewRouteParams;
  SituationInput: SituationInputRouteParams;
};
