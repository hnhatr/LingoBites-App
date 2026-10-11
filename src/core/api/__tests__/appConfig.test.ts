import Config from 'react-native-config';

import {getAppConfig} from '../appConfig';

const mockedConfig = Config as jest.Mocked<typeof Config>;

describe('getAppConfig', () => {
  beforeEach(() => {
    mockedConfig.API_BASE_URL = 'http://localhost:3000';
    mockedConfig.APP_ENV = 'local';
    mockedConfig.AI_SCHEMA_VERSION = 'ai-output-v1';
    mockedConfig.SUPPORT_EMAIL = 'support@lingobites.app';
  });

  it('parses local defaults', () => {
    const config = getAppConfig();
    expect(config.appEnv).toBe('local');
    expect(config.apiBaseUrl).toBe('http://localhost:3000');
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

  it('requires HTTPS API_BASE_URL for staging', () => {
    mockedConfig.APP_ENV = 'staging';
    mockedConfig.API_BASE_URL = 'http://insecure.example.com';
    expect(() => getAppConfig()).toThrow(/HTTPS/);
  });
});
