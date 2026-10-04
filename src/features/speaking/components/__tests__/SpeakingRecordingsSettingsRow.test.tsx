import React from 'react';
import {Switch} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {FeatureFlagProvider} from '@core/release';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {RECORDING_UPLOAD_CONSENT_KEY} from '../../logic/upload/recordingConsent';
import {resetRecordingUploadQueueForTests} from '../../logic/upload/recordingUploadQueue';
import {
  applyRecordingUploadConsent,
  SpeakingRecordingsSettingsRow,
} from '../SpeakingRecordingsSettingsRow';

describe('SpeakingRecordingsSettingsRow', () => {
  beforeEach(() => {
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
    resetRecordingUploadQueueForTests();
  });

  afterEach(() => {
    resetDatabaseForTests(null);
    resetRecordingUploadQueueForTests();
  });

  it('AC-015 S3: turning the switch on stores consent = on', () => {
    applyRecordingUploadConsent('off');
    applyRecordingUploadConsent('on');
    const row = require('@core/db/database')
      .getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ?;', [
        RECORDING_UPLOAD_CONSENT_KEY,
      ])
      .rows?.item(0) as {value?: string};
    expect(row?.value).toBe('on');
  });

  it('INV-002: consent off flips pending rows to local_only', () => {
    const {getDatabase} = require('@core/db/database');
    getDatabase().execute(
      `INSERT INTO speaking_recordings (
        id, lesson_id, sentence_id, mode, file_path, duration_ms, created_at,
        owner_user_id, upload_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'rec-1',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222221',
        'shadowing',
        '/tmp/a.m4a',
        1000,
        '2026-10-04T00:00:00.000Z',
        'user-1',
        'pending',
      ],
    );
    applyRecordingUploadConsent('off');
    const state = getDatabase()
      .execute('SELECT upload_state FROM speaking_recordings WHERE id = ?;', [
        'rec-1',
      ])
      .rows?.item(0) as {upload_state?: string};
    expect(state?.upload_state).toBe('local_only');
  });

  it('renders the upload switch', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={{releaseName: 'test', features: {}}}
        >
          <AppThemeProvider>
            <SpeakingRecordingsSettingsRow />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    expect(tree.root.findAllByType(Switch).length).toBeGreaterThan(0);
  });
});
