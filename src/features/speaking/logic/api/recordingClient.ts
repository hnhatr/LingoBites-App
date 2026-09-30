/* eslint-disable @typescript-eslint/no-unused-vars */
import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {createRequestId} from '@core/api/requestId';
import type {
  CreateRecordingRequest,
  CreateRecordingSuccessResponse,
  RecordingSuccessResponse,
} from '@core/schemas/recordings';

export type CreateRecordingResult =
  | {ok: true; data: CreateRecordingSuccessResponse}
  | {ok: false; errorCode: string; message: string; retryable: boolean};

export type UploadBinaryResult =
  | {ok: true}
  | {ok: false; errorCode: string; message: string; retryable: boolean};

export type RecordingClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export async function createRecordingMetadata(
  request: CreateRecordingRequest,
  options: RecordingClientOptions = {},
): Promise<CreateRecordingResult> {
  const {apiBaseUrl} = getAppConfig();
  // ...
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort());
  }
  const signal = controller.signal;

  try {
    const response = await authenticatedFetch(
      `${apiBaseUrl}/v1/recordings`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal,
      },
      options.fetchImpl,
    );
    clearTimeout(timeoutId);
    if (!response.ok) {
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        message: `Create metadata failed: ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      };
    }
    const data = (await response.json()) as CreateRecordingSuccessResponse;
    return {ok: true, data};
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

// Upload binary requires passing the file bytes. React Native `fetch` can handle FormData or raw blobs/arrays.
export async function uploadRecordingBinary(
  uploadUrl: string,
  contentType: string,
  binaryData: Blob | ArrayBuffer,
  options: RecordingClientOptions = {},
): Promise<UploadBinaryResult> {
  const controller = new AbortController();
  // generous timeout for uploads (60s)
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort());
  }
  const signal = controller.signal;

  try {
    // For PUT to a signed/app URL, we don't necessarily need authenticatedFetch
    // unless the URL is on our API server. The T5 spec says "same-API PUT upload URL",
    // so it probably requires auth. We'll use authenticatedFetch.
    const response = await authenticatedFetch(
      uploadUrl,
      {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: binaryData,
        signal,
      },
      options.fetchImpl,
    );
    clearTimeout(timeoutId);
    if (!response.ok) {
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        message: `Upload failed: ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      };
    }
    return {ok: true};
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}
