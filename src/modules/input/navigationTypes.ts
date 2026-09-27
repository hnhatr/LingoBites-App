import type {OCRSourceType} from '@shared/api/types';

export type HomeMainRouteParams = undefined;
export type CreateMainRouteParams = undefined;
export type PasteTextRouteParams = {analyzeError?: string} | undefined;
export interface ImageCaptureRouteParams {
  sourceType: OCRSourceType;
}
