import i18n from '@/i18n';
import type {OCRImageInput, OCRTextResult} from '@shared/api/types';

const DEFAULT_MOCK_TEXT =
  'We are offering a special discount for new customers.';

export async function extractTextWithMock(
  image: OCRImageInput,
  signal?: AbortSignal,
): Promise<OCRTextResult> {
  if (signal?.aborted) {
    return {ok: false, cancelled: true};
  }

  if (image.uri.includes('no-text')) {
    return {
      ok: false,
      errorCode: 'OCR_NO_TEXT',
      message: i18n.t('errors.ocr_failed'),
      retryable: true,
    };
  }

  return {
    ok: true,
    extractedText: DEFAULT_MOCK_TEXT,
    ocrRawText: DEFAULT_MOCK_TEXT,
    warnings: ['mock_ocr_provider'],
    quality: {
      text_length: DEFAULT_MOCK_TEXT.length,
      text_length_bucket: '1-100',
      line_count: 1,
      has_english_signal: true,
      low_confidence: false,
    },
  };
}
