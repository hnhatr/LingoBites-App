import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  isRecordingUploadConsentOn,
  readRecordingUploadConsent,
  RECORDING_UPLOAD_CONSENT_KEY,
} from '../recordingConsent';

describe('recordingConsent', () => {
  beforeEach(() => {
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
  });

  afterEach(() => {
    resetDatabaseForTests(null);
  });

  it('treats a missing key as undecided', () => {
    expect(readRecordingUploadConsent()).toBe('undecided');
    expect(isRecordingUploadConsentOn()).toBe(false);
  });

  it('reads on from app_settings', () => {
    const {getDatabase} = require('@core/db/database');
    getDatabase().execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [RECORDING_UPLOAD_CONSENT_KEY, 'on', '2026-10-04T00:00:00.000Z'],
    );
    expect(readRecordingUploadConsent()).toBe('on');
    expect(isRecordingUploadConsentOn()).toBe(true);
  });
});
