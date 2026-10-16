import {Platform} from 'react-native';
import Config from 'react-native-config';

import {DEFAULT_SUPPORT_EMAIL} from '../appMetadata';

export type AppConfig = {
  appEnv: AppEnvLabel;
  apiBaseUrl: string;
  aiSchemaVersion: string;
  supportEmail: string;
};

export type AppEnvLabel = 'local' | 'staging' | 'production';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseAppEnv(value: string | undefined): AppEnvLabel {
  if (value === 'staging' || value === 'production') {
    return value;
  }

  return 'local';
}

function resolveApiBaseUrl(appEnv: AppEnvLabel): string {
  const raw = Config.API_BASE_URL?.trim() ?? '';
  if (__DEV__ && !raw) {
    throw new Error(
      'API_BASE_URL is required. Copy .env.example to .env.development.',
    );
  }

  const normalized = normalizeBaseUrl(raw || 'http://localhost:3000');
  if (__DEV__ && appEnv !== 'local' && !normalized.startsWith('https://')) {
    throw new Error(`APP_ENV=${appEnv} requires HTTPS API_BASE_URL`);
  }

  return normalized;
}

export function getAppConfig(): AppConfig {
  const appEnv = parseAppEnv(Config.APP_ENV);

  return {
    appEnv,
    apiBaseUrl: resolveApiBaseUrl(appEnv),
    aiSchemaVersion: Config.AI_SCHEMA_VERSION?.trim() || 'ai-output-v1',
    supportEmail: Config.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
  };
}

export function getSupportEmail(): string {
  return getAppConfig().supportEmail;
}

/**
 * The store version (iOS `MARKETING_VERSION`, Android `versionName`), from
 * the same env values the native builds read. Empty when unset.
 */
export function getAppVersion(): string {
  const raw =
    Platform.OS === 'ios'
      ? Config.IOS_APP_VERSION_NAME
      : Config.ANDROID_APP_VERSION_NAME;
  return raw?.trim() ?? '';
}
