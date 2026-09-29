import {extractText} from '../OCRService';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: () => ({
    apiBaseUrl: 'http://localhost:3001',
    useMockAi: true,
    useMockOcr: true,
  }),
}));

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
  getTextLengthBucket: () => '101-500',
}));

const {trackEvent} = jest.requireMock('@features/analytics') as {
  trackEvent: jest.Mock;
};

describe('OCRService', () => {
  beforeEach(() => {
    trackEvent.mockClear();
  });
  it('uses mock OCR path when USE_MOCK_OCR is true', async () => {
    const result = await extractText({
      uri: 'file:///sample.jpg',
      sourceType: 'camera',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extractedText.length).toBeGreaterThan(0);
    }
  });

  it('returns OCR_NO_TEXT for mock no-text marker', async () => {
    const result = await extractText({
      uri: 'file:///no-text.jpg',
      sourceType: 'gallery',
    });

    expect(result.ok).toBe(false);
    if (!result.ok && !result.cancelled) {
      expect(result.errorCode).toBe('OCR_NO_TEXT');
    }
  });

  it('returns cancelled without emitting a completion analytics event', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await extractText(
      {
        uri: 'file:///sample.jpg',
        sourceType: 'camera',
      },
      controller.signal,
    );

    expect(result).toEqual({ok: false, cancelled: true});
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('ocr_started', {
      provider: 'mock',
      source: 'camera',
    });
  });
});
