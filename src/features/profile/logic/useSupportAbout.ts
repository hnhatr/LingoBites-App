import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {Linking} from 'react-native';

import {getSupportEmail} from '@core/api/appConfig';

import {version as appVersion} from '../../../../package.json';
import type {ProfileStackParamList} from '../screens/navigationTypes';

export type SupportAboutNavigation = NativeStackNavigationProp<
  ProfileStackParamList,
  'SupportAbout'
>;

export function useSupportAbout(navigation: SupportAboutNavigation) {
  const {t} = useTranslation();
  const supportEmail = getSupportEmail();

  function handleSupport() {
    const subject = encodeURIComponent('LingoBites — Góp ý / báo lỗi');
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}`);
  }

  const openPrivacyNote = useCallback(() => {
    navigation.navigate('PrivacyNote');
  }, [navigation]);

  const openFeatureStatus = useCallback(() => {
    navigation.navigate('FeatureStatus');
  }, [navigation]);

  const openTtsSpike = useCallback(() => {
    navigation.navigate('TtsSpike');
  }, [navigation]);

  return {
    appVersion,
    handleSupport,
    openFeatureStatus,
    openPrivacyNote,
    openTtsSpike,
    t,
  };
}
