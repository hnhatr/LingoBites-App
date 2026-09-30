import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {useAppTheme} from '@ui/theme';

import type {ProfileStackParamList} from './navigationTypes';

export function PrivacyNoteScreen() {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<ProfileStackParamList, 'PrivacyNote'>
    >();

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('settings.privacy_title')}
      />
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={{gap: theme.spacing.sm}}>
          <SectionTitle
            icon="shield"
            title={t('settings.privacy_provided_data_title')}
          />
          <AppText color="secondary">{t('settings.privacy_note_body')}</AppText>
        </AppCard>

        <AppCard style={{gap: theme.spacing.sm}}>
          <SectionTitle
            icon="smartphone"
            title={t('settings.privacy_local_storage_title')}
          />
          <AppText color="secondary">{t('settings.local_data_note')}</AppText>
        </AppCard>

        <AppCard style={{gap: theme.spacing.sm}}>
          <SectionTitle
            icon="psychology"
            title={t('settings.privacy_ai_note_title')}
          />
          <AppText color="secondary">
            {t('settings.ai_disclaimer_body')}
          </AppText>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function SectionTitle({icon, title}: {icon: HandoffIconName; title: string}) {
  const {theme} = useAppTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <MaterialIcon color={theme.colors.primary} name={icon} size={22} />
      <AppText accessibilityRole="header" variant="h3">
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
