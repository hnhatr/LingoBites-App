import {featureKeys} from '@/release/feature-registry';
import {makeTestReleaseConfig} from '@/test-support';

describe('makeTestReleaseConfig', () => {
  it('defaults every registry flag to false', () => {
    const config = makeTestReleaseConfig();
    for (const key of featureKeys) {
      expect(config.features[key]).toBe(false);
    }
  });

  it('applies explicit overrides only', () => {
    const config = makeTestReleaseConfig({
      reviewSystem: true,
      ocrScanner: true,
      pasteTextInput: true,
    });
    expect(config.features.reviewSystem).toBe(true);
    expect(config.features.ocrScanner).toBe(true);
    expect(config.features.pasteTextInput).toBe(true);
    expect(config.features.imageInput).toBe(false);
  });
});
