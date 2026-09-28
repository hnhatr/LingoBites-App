import {extractTextFromImage} from './api/ocrClient';
import {getAppConfig} from '@shared/api/appConfig';
import {getTextLengthBucket, trackEvent} from '../analytics';
import type {OCRImageInput, OCRTextResult} from '@shared/api/types';
import {extractTextWithMock} from './MockOCRService';

export async function extractText(
  image: OCRImageInput,
  signal?: AbortSignal,
): Promise<OCRTextResult> {
  const {useMockOcr} = getAppConfig();
  const provider = useMockOcr ? 'mock' : 'api';

  trackEvent('ocr_started', {
    provider,
    source: image.sourceType,
  });

  const result = useMockOcr
    ? await extractTextWithMock(image, signal)
    : await extractTextFromImage(image, signal);

  if (!result.ok && result.cancelled) {
    return result;
  }

  if (result.ok) {
    trackEvent('ocr_completed', {
      status: 'success',
      text_length_bucket: getTextLengthBucket(
        result.extractedText.trim().length,
      ),
      confidence: result.confidence,
    });
    return result;
  }

  trackEvent('ocr_completed', {
    status: 'failed',
    error_code: result.errorCode,
  });

  return result;
}
