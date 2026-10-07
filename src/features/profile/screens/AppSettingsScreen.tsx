import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {ThemePicker} from '@ui/components/ThemePicker';
import {useAppTheme} from '@ui/theme';

import {useFeatureFlags} from '@core/release';

import {ProfileSubpage} from '../components/ProfileSubpage';
import type {ProfileStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AppSettings'>;

/** App-wide preferences (appearance for now; room for language, etc.). */
export function AppSettingsScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const {isFeatureEnabled} = useFeatureFlags();

  return (
    <ProfileSubpage onBack={() => navigation.goBack()} title="Cài đặt ứng dụng">
      {isFeatureEnabled('themeSwitcher') ? (
        <SettingsGroup title="Giao diện">
          <View style={[styles.body, {gap: theme.spacing.sm}]}>
            <AppText color="secondary" variant="caption">
              Chọn theme — áp dụng ngay cho toàn app.
            </AppText>
            <ThemePicker />
          </View>
        </SettingsGroup>
      ) : null}
    </ProfileSubpage>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
  },
});
