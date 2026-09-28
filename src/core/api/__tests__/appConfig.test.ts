import Config from 'react-native-config';
import {getAppConfig} from '../appConfig';

const mockedConfig = Config as jest.Mocked<typeof Config>;

describe('getAppConfig', () => {
  beforeEach(() => {
    mockedConfig.API_BASE_URL = 'http://localhost:3000';
    mockedConfig.USE_MOCK_AI = 'true';
    mockedConfig.USE_MOCK_OCR = 'true';
    mockedConfig.APP_ENV = 'local';
    mockedConfig.AI_SCHEMA_VERSION = 'ai-output-v1';
    mockedConfig.SUPPORT_EMAIL = 'support@lingobites.app';
  });

  it('parses local defaults with mock AI', () => {
    const config = getAppConfig();
    expect(config.appEnv).toBe('local');
    expect(config.apiBaseUrl).toBe('http://localhost:3000');
    expect(config.useMockAi).toBe(true);
    expect(config.aiSchemaVersion).toBe('ai-output-v1');
  });

  it('strips trailing slashes from API_BASE_URL', () => {
    mockedConfig.API_BASE_URL = 'http://localhost:3000/';
    expect(getAppConfig().apiBaseUrl).toBe('http://localhost:3000');
  });

  it('throws in __DEV__ when API_BASE_URL is missing', () => {
    mockedConfig.API_BASE_URL = '';
    expect(() => getAppConfig()).toThrow(/API_BASE_URL/);
  });

  it('throws when production uses mock AI', () => {
    mockedConfig.APP_ENV = 'production';
    mockedConfig.USE_MOCK_AI = 'true';
    mockedConfig.API_BASE_URL = 'https://api.example.com';
    expect(() => getAppConfig()).toThrow(/USE_MOCK_AI/);
  });

  it('throws when production release config uses mock AI', () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;

    mockedConfig.APP_ENV = 'production';
    mockedConfig.USE_MOCK_AI = 'true';
    mockedConfig.API_BASE_URL = 'https://api.example.com';

    try {
      expect(() => getAppConfig()).toThrow(/USE_MOCK_AI/);
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });

  it('requires HTTPS API_BASE_URL for staging', () => {
    mockedConfig.APP_ENV = 'staging';
    mockedConfig.API_BASE_URL = 'http://insecure.example.com';
    mockedConfig.USE_MOCK_AI = 'false';
    expect(() => getAppConfig()).toThrow(/HTTPS/);
  });
});
