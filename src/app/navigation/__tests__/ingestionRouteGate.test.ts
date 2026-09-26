import {
  isCapabilityChainEnabled,
  isIngestionRouteEnabled,
} from '../ingestionRouteGate';

const enabled = (overrides: Record<string, boolean> = {}) => ({
  pasteTextInput: true,
  imageInput: true,
  ocrScanner: true,
  ocrReviewEdit: true,
  ...overrides,
});

describe('isIngestionRouteEnabled', () => {
  it('registers each route only when its complete capability chain is enabled', () => {
    expect(isIngestionRouteEnabled('PasteText', enabled())).toBe(true);
    expect(isIngestionRouteEnabled('ImageCapture', enabled())).toBe(true);
    expect(isIngestionRouteEnabled('OCRReview', enabled())).toBe(true);

    expect(
      isIngestionRouteEnabled('ImageCapture', enabled({imageInput: false})),
    ).toBe(false);
    expect(
      isIngestionRouteEnabled('OCRReview', enabled({ocrScanner: false})),
    ).toBe(false);
    expect(
      isIngestionRouteEnabled('PasteText', enabled({pasteTextInput: false})),
    ).toBe(false);
    expect(isIngestionRouteEnabled('Unknown', enabled())).toBe(false);
  });

  it('supports OR dependency groups without allowing a disabled capability', () => {
    const dependencies = {
      pasteTextInput: [],
      imageInput: [],
      ocrScanner: [['imageInput']],
      ocrReviewEdit: [['ocrScanner']],
    } as never;

    expect(
      isCapabilityChainEnabled(
        'ocrReviewEdit',
        enabled({imageInput: true, ocrScanner: true, ocrReviewEdit: true}),
        dependencies,
      ),
    ).toBe(true);
    expect(
      isCapabilityChainEnabled(
        'ocrReviewEdit',
        enabled({imageInput: false, ocrScanner: true, ocrReviewEdit: true}),
        dependencies,
      ),
    ).toBe(false);
  });
});
