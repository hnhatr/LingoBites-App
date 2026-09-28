import {Platform} from 'react-native';
import Config from 'react-native-config';
import {APP_VERSION} from '@shared/appMetadata';
import {getOrCreateAnonymousUserId} from '@shared/db/anonymousUserId';
import {createConsoleAnalyticsAdapter} from './adapters/ConsoleAnalyticsAdapter';
import {createFirebaseAnalyticsAdapter} from './adapters/FirebaseAnalyticsAdapter';
import type {
  AnalyticsAdapter,
  AnalyticsEventName,
  AnalyticsProperties,
  ImageSizeCategory,
} from './types';

export type AnalyticsProvider = 'console' | 'firebase-stub';

function createAnalyticsAdapter(provider: AnalyticsProvider): AnalyticsAdapter {
  if (provider === 'firebase-stub') {
    return createFirebaseAnalyticsAdapter();
  }
  return createConsoleAnalyticsAdapter();
}

function resolveAnalyticsProvider(): AnalyticsProvider {
  const raw = Config.ANALYTICS_PROVIDER?.trim().toLowerCase();
  if (raw === 'firebase' || raw === 'firebase-stub') {
    return 'firebase-stub';
  }
  return 'console';
}

let adapter: AnalyticsAdapter = createAnalyticsAdapter(
  resolveAnalyticsProvider(),
);

export function setAnalyticsAdapter(nextAdapter: AnalyticsAdapter): void {
  adapter = nextAdapter;
}

export function resetAnalyticsAdapter(): void {
  adapter = createAnalyticsAdapter(resolveAnalyticsProvider());
}

export function trackEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties,
): void {
  adapter.track(event, properties);
}

export function trackAppOpened(): void {
  let userId: string | undefined;
  try {
    userId = getOrCreateAnonymousUserId();
  } catch {
    userId = undefined;
  }

  trackEvent('app_opened', {
    user_id: userId,
    app_version: APP_VERSION,
    platform: Platform.OS,
  });
}

export function getImageSizeCategory(
  width?: number,
  height?: number,
): ImageSizeCategory {
  const pixels = (width ?? 0) * (height ?? 0);
  if (pixels <= 0) {
    return 'medium';
  }
  if (pixels < 500_000) {
    return 'small';
  }
  if (pixels < 2_000_000) {
    return 'medium';
  }
  return 'large';
}
