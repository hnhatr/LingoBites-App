import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {FeatureFlagProvider} from '@core/release';

import {
  ALL_IMPLEMENTED_FEATURES,
  makeTestReleaseConfig,
  mockAppNavigation,
} from '@test/support';

import {
  resolveYouTubeLessonCreationStatus,
  useYouTubeLessonCreation,
} from '../useYouTubeLessonCreation';

const mockCapabilityStatus = jest.fn(() => 'enabled');
const mockRefresh = jest.fn();

jest.mock('@core/api/youtubeCapabilities', () => ({
  useYouTubeCapability: () => ({
    status: mockCapabilityStatus(),
    refresh: mockRefresh,
  }),
}));

describe('resolveYouTubeLessonCreationStatus', () => {
  const base = {
    featureEnabled: true,
    capability: 'enabled' as const,
    limitReached: false,
  };

  it('is available when every gate passes', () => {
    expect(resolveYouTubeLessonCreationStatus(base)).toBe('available');
  });

  it('is unavailable when the flag is off, whatever the server says', () => {
    expect(
      resolveYouTubeLessonCreationStatus({
        ...base,
        featureEnabled: false,
        capability: 'checking',
      }),
    ).toBe('unavailable');
  });

  it('follows the server capability', () => {
    expect(
      resolveYouTubeLessonCreationStatus({...base, capability: 'checking'}),
    ).toBe('checking');
    expect(
      resolveYouTubeLessonCreationStatus({...base, capability: 'disabled'}),
    ).toBe('unavailable');
  });

  it('reports the link allowance last', () => {
    expect(
      resolveYouTubeLessonCreationStatus({...base, limitReached: true}),
    ).toBe('limit_reached');
  });
});

describe('useYouTubeLessonCreation', () => {
  let latest!: ReturnType<typeof useYouTubeLessonCreation>;

  function Probe() {
    latest = useYouTubeLessonCreation();
    return null;
  }

  function render(features?: Parameters<typeof makeTestReleaseConfig>[0]) {
    act(() => {
      ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={features ? makeTestReleaseConfig(features) : undefined}
        >
          <Probe />
        </FeatureFlagProvider>,
      );
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapabilityStatus.mockReturnValue('enabled');
  });

  it('opens the YouTube link composer when available', () => {
    render(ALL_IMPLEMENTED_FEATURES);
    expect(latest.status).toBe('available');
    let opened = false;
    act(() => {
      opened = latest.start();
    });
    expect(opened).toBe(true);
    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'youtube',
    });
  });

  it('does not navigate while unavailable', () => {
    mockCapabilityStatus.mockReturnValue('disabled');
    render(ALL_IMPLEMENTED_FEATURES);
    expect(latest.status).toBe('unavailable');
    expect(latest.start()).toBe(false);
    expect(mockAppNavigation.startCreate).not.toHaveBeenCalled();
  });

  it('does not re-probe on the first focus (the capability hook already did)', () => {
    render(ALL_IMPLEMENTED_FEATURES);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
