import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {useIsOffline} from '@core/api/connectivity';

import {useAppTheme} from '../theme';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

/**
 * Thin strip shown while the Server is unreachable
 * (docs/architecture/offline-mode.md §3). Renders nothing online.
 */
export function OfflineBanner() {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const offline = useIsOffline();
  if (!offline) {
    return null;
  }
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.container, {backgroundColor: theme.colors.surfaceMuted}]}
      testID="offline-banner"
    >
      <MaterialIcon color={theme.colors.text.secondary} name="info" size={16} />
      <AppText color="secondary" variant="caption" style={styles.message}>
        {t('offline.banner')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  message: {
    flex: 1,
  },
});
