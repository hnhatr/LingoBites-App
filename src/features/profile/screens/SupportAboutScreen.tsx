import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';

import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SettingsGroup} from '@ui/components/SettingsGroup';

import {ProfileSubpage} from '../components/ProfileSubpage';
import {useSupportAbout} from '../logic/useSupportAbout';
import type {ProfileStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SupportAbout'>;

/** Help, privacy and app information (plus dev tools in dev builds). */
export function SupportAboutScreen({navigation}: Props) {
  const {
    appVersion,
    handleSupport,
    openFeatureStatus,
    openPrivacyNote,
    openTtsSpike,
    t,
  } = useSupportAbout(navigation);

  return (
    <ProfileSubpage
      onBack={() => navigation.goBack()}
      title="Hỗ trợ & thông tin"
    >
      <SettingsGroup title="Hỗ trợ">
        <ProfileSettingsRow
          accessibilityHint="Chạm để mở"
          accessibilityLabel="Trợ giúp và góp ý"
          icon="help"
          label="Trợ giúp & góp ý"
          medallionTone="coral"
          onPress={handleSupport}
          trailing="chevron"
        />
        <ProfileSettingsRow
          accessibilityHint="Chạm để mở"
          accessibilityLabel="Quyền riêng tư"
          icon="visibility"
          label="Quyền riêng tư"
          medallionTone="gold"
          onPress={openPrivacyNote}
          trailing="chevron"
        />
      </SettingsGroup>

      <SettingsGroup title="Về ứng dụng">
        <ProfileSettingsRow
          accessibilityLabel={`Phiên bản ${appVersion}`}
          icon="info"
          label="Phiên bản"
          medallionTone="teal"
          trailing={{text: appVersion}}
        />
      </SettingsGroup>

      {__DEV__ ? (
        <SettingsGroup title="Dành cho dev">
          <ProfileSettingsRow
            accessibilityHint="Chạm để mở"
            accessibilityLabel={t('settings.feature_status')}
            icon="bolt"
            label={t('settings.feature_status')}
            medallionTone="teal"
            onPress={openFeatureStatus}
            trailing="chevron"
          />
          <ProfileSettingsRow
            accessibilityHint="Chạm để mở"
            accessibilityLabel="Mở bản demo native TTS"
            icon="volume_up"
            label="Demo native TTS"
            medallionTone="coral"
            onPress={openTtsSpike}
            trailing="chevron"
          />
        </SettingsGroup>
      ) : null}
    </ProfileSubpage>
  );
}
