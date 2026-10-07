import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useRef} from 'react';

import {
  useYouTubeCapability,
  type YouTubeCapabilityStatus,
} from '@core/api/youtubeCapabilities';
import {useAppNavigation} from '@core/navigation';
import {useFeatureFlags} from '@core/release';

export type YouTubeLessonCreationStatus =
  /** The server capability probe is still in flight. */
  | 'checking'
  | 'available'
  /** Feature flag off, or the server does not offer YouTube creation. */
  | 'unavailable'
  /** The learner used up their YouTube link allowance. */
  | 'limit_reached';

export type YouTubeLessonCreation = {
  status: YouTubeLessonCreationStatus;
  /**
   * Opens the YouTube link composer when creation is available. Returns
   * whether it opened, so callers can explain why it did not.
   */
  start: () => boolean;
};

export type YouTubeLessonCreationInput = {
  featureEnabled: boolean;
  capability: YouTubeCapabilityStatus;
  limitReached: boolean;
};

/**
 * Every gate in front of a YouTube lesson, in order. Creating a lesson from
 * a link costs a transcript fetch plus AI calls, so the link allowance is
 * checked here too, once the per-learner limit exists.
 */
export function resolveYouTubeLessonCreationStatus({
  featureEnabled,
  capability,
  limitReached,
}: YouTubeLessonCreationInput): YouTubeLessonCreationStatus {
  if (!featureEnabled) return 'unavailable';
  if (capability === 'checking') return 'checking';
  if (capability === 'disabled') return 'unavailable';
  if (limitReached) return 'limit_reached';
  return 'available';
}

/**
 * The single entry point for "create a lesson from a YouTube link", shared
 * by the create hub and the video hub. Re-probes the server each time the
 * screen regains focus, so a failed first probe does not lock the entry.
 */
export function useYouTubeLessonCreation(): YouTubeLessonCreation {
  const navigation = useAppNavigation();
  const featureEnabled = useFeatureFlags().config.features.youtubeLearning;
  const capability = useYouTubeCapability();
  const refreshCapability = capability.refresh;

  // The capability hook probes on mount; only later focuses re-probe.
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      refreshCapability();
    }, [refreshCapability]),
  );

  // No per-learner link allowance yet: the server only rate-limits.
  const limitReached = false;
  const status = resolveYouTubeLessonCreationStatus({
    featureEnabled,
    capability: capability.status,
    limitReached,
  });

  const start = useCallback(() => {
    if (status !== 'available') return false;
    navigation.startCreate({kind: 'youtube'});
    return true;
  }, [navigation, status]);

  return {status, start};
}
