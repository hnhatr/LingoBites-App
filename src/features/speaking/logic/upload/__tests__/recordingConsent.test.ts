import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  isEvaluationConsentOn,
  isRecordingUploadConsentOn,
  readEvaluationConsent,
  readRecordingUploadConsent,
  RECORDING_UPLOAD_CONSENT_KEY,
  setEvaluationConsent,
  shouldAskEvaluationConsent,
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

describe('evaluation consent (PR 14)', () => {
  beforeEach(() => {
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
  });

  afterEach(() => {
    resetDatabaseForTests(null);
  });

  it('is asked while undecided, then again only 7 days after a no', () => {
    const t0 = new Date('2026-10-01T00:00:00.000Z');
    expect(readEvaluationConsent()).toBe('undecided');
    expect(shouldAskEvaluationConsent(t0)).toBe(true);
    setEvaluationConsent('off', t0);
    expect(
      shouldAskEvaluationConsent(new Date('2026-10-07T23:00:00.000Z')),
    ).toBe(false);
    expect(
      shouldAskEvaluationConsent(new Date('2026-10-08T00:00:00.000Z')),
    ).toBe(true);
    setEvaluationConsent('on', t0);
    expect(isEvaluationConsentOn()).toBe(true);
    expect(shouldAskEvaluationConsent(t0)).toBe(false);
    // The upload consent is a different question.
    expect(readRecordingUploadConsent()).toBe('undecided');
  });
});
