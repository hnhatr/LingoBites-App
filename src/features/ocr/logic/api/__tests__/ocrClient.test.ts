/* eslint-disable @typescript-eslint/no-unused-vars */
import i18n from '@core/i18n/index';
import {extractTextFromImage} from '../ocrClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const successBody = {
  request_id: '00000000-0000-0000-0000-000000000001',
  status: 'success',
  provider: 'mock',
  ocr_raw_text: 'Hello world',
  extracted_text: 'Hello world',
  quality: {
    text_length: 11,
    text_length_bucket: '1-100',
    line_count: 1,
    has_english_signal: true,
    low_confidence: false,
  },
  warnings: [],
};

describe('extractTextFromImage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    jest.useRealTimers();
  });

  it('returns extracted text on success envelope', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => successBody,
    });

    const result = await extractTextFromImage({
      uri: 'file:///sample.jpg',
      sourceType: 'gallery',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extractedText).toBe('Hello world');
    }

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/ocr',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('returns friendly error for OCR_NO_TEXT', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        request_id: '00000000-0000-0000-0000-000000000002',
        status: 'failed',
        error: {
          code: 'OCR_NO_TEXT',
          message: 'No readable text was detected.',
        },
        retryable: true,
      }),
    });

    const result = await extractTextFromImage({
      uri: 'file:///blank.jpg',
      sourceType: 'camera',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'OCR_NO_TEXT',
      message: i18n.t('errors.ocr_failed'),
      retryable: true,
    });
  });

  it('returns cancelled immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await extractTextFromImage(
      {
        uri: 'file:///sample.jpg',
        sourceType: 'gallery',
      },
      controller.signal,
    );

    expect(result).toEqual({ok: false, cancelled: true});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns cancelled when the signal aborts while the request is in flight', async () => {
    const controller = new AbortController();
    let resolveFetch: (value: unknown) => void = () => {};
    mockFetch.mockImplementation(
      (_url, options) =>
        new Promise((resolve, reject) => {
          resolveFetch = resolve;
          if (options.signal.aborted) {
            const err = new Error('abort');
            err.name = 'AbortError';
            return reject(err);
          }
          options.signal.addEventListener('abort', () => {
            const err = new Error('abort');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const pending = extractTextFromImage(
      {
        uri: 'file:///sample.jpg',
        sourceType: 'gallery',
      },
      controller.signal,
    );
    // Let ensureValidSession run
    await new Promise(r => setTimeout(r, 0));
    controller.abort();

    // We don't resolveFetch here because it should reject via abort!

    await expect(pending).resolves.toEqual({ok: false, cancelled: true});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns OCR_TIMEOUT when the fetch never resolves before the timeout', async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, options: {signal: AbortSignal}) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const pending = extractTextFromImage({
      uri: 'file:///sample.jpg',
      sourceType: 'gallery',
    });

    await jest.advanceTimersByTimeAsync(30_000);

    await expect(pending).resolves.toEqual({
      ok: false,
      errorCode: 'OCR_TIMEOUT',
      message: i18n.t('errors.ocr_timeout'),
      retryable: true,
    });
  });
});
