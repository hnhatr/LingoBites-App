import {getDatabase} from '@core/db/database';

export const RECORDING_UPLOAD_CONSENT_KEY = 'speaking.recording_upload_consent';

export type RecordingUploadConsentValue = 'on' | 'off' | 'undecided';

export function readRecordingUploadConsent(): RecordingUploadConsentValue {
  const db = getDatabase();
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      RECORDING_UPLOAD_CONSENT_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  if (row?.value === 'on') return 'on';
  if (row?.value === 'off') return 'off';
  return 'undecided';
}

export function isRecordingUploadConsentOn(): boolean {
  return readRecordingUploadConsent() === 'on';
}
