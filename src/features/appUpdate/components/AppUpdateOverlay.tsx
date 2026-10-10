import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {HandoffProgressTrack} from '@ui/components/HandoffProgressTrack';
import {useAppTheme} from '@ui/theme';

import {useLaunchUpdate} from '../logic/useLaunchUpdate';

/**
 * Full-screen cover shown while a launch OTA update downloads, so the app
 * restarts straight into the new bundle instead of on the next cold start.
 * Renders nothing while checking or when there is no update.
 */
export function AppUpdateOverlay() {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const {phase, progress} = useLaunchUpdate();

  if (phase !== 'downloading' && phase !== 'reloading') {
    return null;
  }
  const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.overlay, {backgroundColor: theme.colors.background}]}
      testID="app-update-overlay"
    >
      <View style={styles.content}>
        <AppText variant="h3">{t('app_update.title')}</AppText>
        <AppText color="secondary" style={styles.message}>
          {t('app_update.message')}
        </AppText>
        <HandoffProgressTrack
          label={t('app_update.progress', {percent})}
          progress={progress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 1000,
    elevation: 1000,
  },
  content: {
    gap: 16,
  },
  message: {
    marginBottom: 8,
  },
});
