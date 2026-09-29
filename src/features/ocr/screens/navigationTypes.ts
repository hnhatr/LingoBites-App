import type {OCRSourceType} from '@core/api/types';

export interface OCRReviewRouteParams {
  imageUri: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sourceType: OCRSourceType;
  extractedText: string;
  warnings?: string[];
  analyzeError?: string;
}
