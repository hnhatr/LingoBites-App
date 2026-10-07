import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';

import {AccountProfileSection} from '@features/account';

import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SettingsGroup} from '@ui/components/SettingsGroup';

import {ProfileSubpage} from '../components/ProfileSubpage';
import {useAccountSettings} from '../logic/useAccountSettings';
import type {ProfileStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountSettings'>;

/** User-related settings: identity form, sync and sign-out. */
export function AccountSettingsScreen({navigation}: Props) {
  const {
    accountPhase,
    handleSignOut,
    handleSyncNow,
    isLoggingOut,
    isSyncing,
    statusMessage,
    syncTrailingLabel,
    t,
  } = useAccountSettings();

  return (
    <ProfileSubpage
      onBack={() => navigation.goBack()}
      statusMessage={statusMessage}
      title="Tài khoản"
    >
      <AccountProfileSection />

      {accountPhase === 'authenticated' ? (
        <SettingsGroup title="Đồng bộ & phiên đăng nhập">
          <ProfileSettingsRow
            accessibilityHint="Gửi và nhận dữ liệu học với tài khoản ngay bây giờ"
            accessibilityLabel={`Đồng bộ ngay. ${syncTrailingLabel}`}
            icon="refresh"
            label="Đồng bộ ngay"
            medallionTone="gold"
            onPress={isSyncing ? undefined : handleSyncNow}
            trailing={{text: syncTrailingLabel}}
          />
          <ProfileSettingsRow
            accessibilityHint={t('account.sign_out_hint')}
            accessibilityLabel={t('account.sign_out')}
            destructive
            disabled={isLoggingOut}
            icon="person"
            label={t('account.sign_out')}
            onPress={handleSignOut}
            trailing="chevron"
          />
        </SettingsGroup>
      ) : null}
    </ProfileSubpage>
  );
}
