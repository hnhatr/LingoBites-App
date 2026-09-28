import Config from 'react-native-config';
import {DEFAULT_SUPPORT_EMAIL} from '../appMetadata';

export type AppConfig = {
  appEnv: AppEnvLabel;
  apiBaseUrl: string;
  useMockAi: boolean;
  useMockOcr: boolean;
  aiSchemaVersion: string;
  supportEmail: string;
};

export type AppEnvLabel = 'local' | 'staging' | 'production';

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  return value.trim().toLowerCase() === 'true';
}

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

function assertProductionSafety(appEnv: AppEnvLabel, useMockAi: boolean): void {
  if (appEnv === 'production' && useMockAi) {
    throw new Error('USE_MOCK_AI must be false when APP_ENV=production');
  }
}

export function getAppConfig(): AppConfig {
  const appEnv = parseAppEnv(Config.APP_ENV);
  const useMockAi = parseBool(Config.USE_MOCK_AI, true);
  assertProductionSafety(appEnv, useMockAi);

  return {
    appEnv,
    apiBaseUrl: resolveApiBaseUrl(appEnv),
    useMockAi,
    useMockOcr: parseBool(Config.USE_MOCK_OCR, true),
    aiSchemaVersion: Config.AI_SCHEMA_VERSION?.trim() || 'ai-output-v1',
    supportEmail: Config.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
  };
}

export function getSupportEmail(): string {
  return getAppConfig().supportEmail;
}
