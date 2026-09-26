import {authenticatedFetch} from './authenticatedFetch';
import {Platform} from 'react-native';
import {createRequestId} from './requestId';
import {getAppConfig} from './appConfig';
import i18n from '@/i18n';
import type {
  ApiErrorBody,
  OCRImageInput,
  OCRSuccessBody,
  OCRTextResult,
} from './types';

const OCR_FETCH_TIMEOUT_MS = 30_000;

const cancelledResult = (): OCRTextResult => ({ok: false, cancelled: true});

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function withTimeout(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
): {signal: AbortSignal; cleanup: () => void} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, {once: true});
  const cleanup = () => {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  };
  return {signal: controller.signal, cleanup};
}

function mapOcrErrorToMessage(code: string, serverMessage?: string): string {
  switch (code) {
    case 'OCR_NO_TEXT':
    case 'OCR_PROVIDER_ERROR':
      return i18n.t('errors.ocr_failed');
    case 'OCR_TIMEOUT':
      return i18n.t('errors.ocr_timeout');
    case 'IMAGE_TOO_LARGE':
      return serverMessage?.trim() || i18n.t('errors.ocr_failed');
    default:
      return serverMessage?.trim() || i18n.t('errors.ocr_failed');
  }
}

function isFailedBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    (body as ApiErrorBody).status === 'failed'
  );
}

function isSuccessBody(body: unknown): body is OCRSuccessBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    (body as OCRSuccessBody).status === 'success' &&
    'extracted_text' in body
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function extractTextFromImage(
  image: OCRImageInput,
  signal?: AbortSignal,
): Promise<OCRTextResult> {
  if (isAborted(signal)) {
    return cancelledResult();
  }

  const {apiBaseUrl} = getAppConfig();
  const requestId = createRequestId();
  const platform =
    Platform.OS === 'ios'
      ? 'ios'
      : Platform.OS === 'android'
      ? 'android'
      : undefined;

  const formData = new FormData();
  formData.append('request_id', requestId);
  formData.append('source_type', image.sourceType);
  if (platform) {
    formData.append('platform', platform);
  }
  formData.append('app_version', '0.1.0');
  if (image.width) {
    formData.append('image_width', String(image.width));
  }
  if (image.height) {
    formData.append('image_height', String(image.height));
  }

  formData.append('image', {
    uri: image.uri,
    name: image.fileName ?? 'image.jpg',
    type: image.type ?? 'image/jpeg',
  } as unknown as Blob);

  let response: Response;
  try {
    const {signal: fetchSignal, cleanup} = withTimeout(
      OCR_FETCH_TIMEOUT_MS,
      signal,
    );
    try {
      response = await authenticatedFetch(`${apiBaseUrl}/v1/ocr`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
        signal: fetchSignal,
      });
    } finally {
      cleanup();
    }
  } catch (error) {
    if (isAborted(signal)) {
      return cancelledResult();
    }
    if (isAbortError(error)) {
      return {
        ok: false,
        errorCode: 'OCR_TIMEOUT',
        message: i18n.t('errors.ocr_timeout'),
        retryable: true,
      };
    }
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
    };
  }

  if (isAborted(signal)) {
    return cancelledResult();
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (isAborted(signal)) {
      return cancelledResult();
    }
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
    };
  }

  if (isAborted(signal)) {
    return cancelledResult();
  }

  if (!response.ok || isFailedBody(body)) {
    const errorBody = isFailedBody(body) ? body : undefined;
    const code = errorBody?.error.code ?? 'OCR_PROVIDER_ERROR';
    return {
      ok: false,
      errorCode: code,
      message: mapOcrErrorToMessage(code, errorBody?.error.message),
      retryable: errorBody?.retryable,
    };
  }

  if (!isSuccessBody(body)) {
    return {
      ok: false,
      errorCode: 'OCR_PROVIDER_ERROR',
      message: i18n.t('errors.ocr_failed'),
    };
  }

  return {
    ok: true,
    extractedText: body.extracted_text,
    ocrRawText: body.ocr_raw_text,
    warnings: body.warnings ?? [],
    quality: body.quality,
  };
}
