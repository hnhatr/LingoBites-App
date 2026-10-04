import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Switch, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SectionHeader} from '@ui/components/SectionHeader';
import {useAppTheme} from '@ui/theme';

import {getDatabase, withTransaction} from '@core/db/database';

import {
  isRecordingUploadConsentOn,
  readRecordingUploadConsent,
  RECORDING_UPLOAD_CONSENT_KEY,
} from '../logic/upload/recordingConsent';
import {requestRecordingUploadDrain} from '../logic/upload/recordingUploadQueue';
import {
  queueAccountOnlyServerRecordingDelete,
  readPendingServerDeleteMarker,
} from '../logic/upload/serverRecordingDeletion';

const CURRENT_ACCOUNT_ID_KEY = 'current_account_id';

function readCurrentAccountId(): string | null {
  const row = getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      CURRENT_ACCOUNT_ID_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function flipAllPendingRecordingsToLocalOnly(): void {
  getDatabase().execute(
    `UPDATE speaking_recordings
     SET upload_state = 'local_only',
         upload_next_at = NULL,
         upload_error = NULL,
         server_recording_id = NULL
     WHERE upload_state = 'pending';`,
  );
}

/** Persists consent and flips pending uploads when turning off (INV-002). */
export function applyRecordingUploadConsent(value: 'on' | 'off'): void {
  withTransaction(getDatabase(), () => {
    const now = new Date().toISOString();
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [RECORDING_UPLOAD_CONSENT_KEY, value, now],
    );
    if (value === 'off') {
      flipAllPendingRecordingsToLocalOnly();
    }
  });
  if (value === 'on') {
    requestRecordingUploadDrain();
  }
}

export function SpeakingRecordingsSettingsRow() {
  const {theme} = useAppTheme();
  const [consentOn, setConsentOn] = useState(isRecordingUploadConsentOn());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshConsent = useCallback(() => {
    setConsentOn(readRecordingUploadConsent() === 'on');
    const marker = readPendingServerDeleteMarker();
    setStatusMessage(marker ? 'Đang xóa bản ghi trên tài khoản…' : null);
  }, []);

  useEffect(() => {
    refreshConsent();
  }, [refreshConsent]);

  const handleToggle = useCallback(
    (next: boolean) => {
      applyRecordingUploadConsent(next ? 'on' : 'off');
      setConsentOn(next);
      refreshConsent();
    },
    [refreshConsent],
  );

  const handleDeleteOnAccount = useCallback(() => {
    const ownerUserId = readCurrentAccountId();
    if (!ownerUserId) {
      setStatusMessage('Cần đăng nhập để xóa bản ghi trên tài khoản.');
      return;
    }
    Alert.alert(
      'Xoá bản ghi trên tài khoản?',
      'Bản ghi trên máy này vẫn được giữ. Thao tác sẽ xóa bản ghi đã tải lên tài khoản của bạn.',
      [
        {text: 'Huỷ', style: 'cancel'},
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            queueAccountOnlyServerRecordingDelete(ownerUserId);
            refreshConsent();
          },
        },
      ],
    );
  }, [refreshConsent]);

  return (
    <View testID="speaking-recordings-settings">
      <SectionHeader title="Bản ghi giọng nói" />
      <ProfileSettingsRow
        accessibilityLabel="Tải bản ghi lên tài khoản"
        icon="upload_file"
        label="Tải bản ghi lên tài khoản"
        medallionTone="teal"
        trailing={{
          text: consentOn ? 'Bật' : 'Tắt',
        }}
      />
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <AppText color="secondary" variant="caption">
          Đồng bộ bản ghi luyện nói lên tài khoản
        </AppText>
        <Switch
          accessibilityLabel="Tải bản ghi lên tài khoản"
          onValueChange={handleToggle}
          testID="speaking-recordings-upload-switch"
          value={consentOn}
        />
      </View>
      <View style={{paddingHorizontal: theme.spacing.lg}}>
        <AppButton
          accessibilityLabel="Xoá bản ghi trên tài khoản"
          onPress={handleDeleteOnAccount}
          testID="speaking-recordings-delete-on-account"
          title="Xoá bản ghi trên tài khoản"
          variant="secondary-coral"
        />
        {statusMessage ? (
          <AppText
            color="secondary"
            style={{marginTop: theme.spacing.sm}}
            testID="speaking-recordings-status"
          >
            {statusMessage}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
