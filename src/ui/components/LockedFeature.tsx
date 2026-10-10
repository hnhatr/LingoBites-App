import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {probeConnectivity} from '@core/api/connectivity';

import {useAppTheme} from '../theme';
import {getStickerFace} from '../theme/hardShadow';
import {AppButton} from './AppButton';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

type Props = {
  /** Why the feature needs the Server. */
  message: string;
  testID?: string;
};

/**
 * Shared locked state for features that need the Server
 * (docs/architecture/offline-mode.md §3): icon, reason and a "Thử lại"
 * action that probes the connection — never a hidden feature or an endless
 * spinner. A successful probe flips the connectivity store, which unlocks
 * the caller.
 */
export function LockedFeature({message, testID = 'locked-feature'}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const [checking, setChecking] = useState(false);

  const retry = () => {
    if (checking) {
      return;
    }
    setChecking(true);
    probeConnectivity().finally(() => setChecking(false));
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
        getStickerFace(theme),
      ]}
      testID={testID}
    >
      <View style={styles.titleRow}>
        <MaterialIcon
          color={theme.colors.text.secondary}
          name="lock"
          size={20}
        />
        <AppText variant="label">{t('offline.locked_title')}</AppText>
      </View>
      <AppText color="secondary">{message}</AppText>
      <AppButton
        accessibilityHint={t('offline.retry_hint')}
        accessibilityLabel={t('offline.retry')}
        disabled={checking}
        onPress={retry}
        title={checking ? t('offline.checking') : t('offline.retry')}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
