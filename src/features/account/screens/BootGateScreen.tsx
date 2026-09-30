import React from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';

import {useAccountStore} from '../logic/useAccountStore';

/**
 * Boot gate (SETE-303 / T6): splash while bootstrapping and explicit retry
 * states when boot cannot reach `authenticated`. This screen never collects
 * a display name — that belongs to `OnboardingNameScreen` — so a returning
 * install that hits a transient failure is never asked for its name again.
 */
export function BootGateScreen() {
  const {t} = useTranslation();
  const phase = useAccountStore(state => state.phase);
  const failureMessage = useAccountStore(state => state.failureMessage);
  const retry = useAccountStore(state => state.retry);

  if (phase === 'bootstrapping') {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </AppScreen>
    );
  }

  // Post-logout gate: stable, no spinner, no automatic bootstrap. Continue
  // rejoins the existing retry/boot path exactly once per tap.
  if (phase === 'signed-out') {
    return (
      <AppScreen>
        <View style={styles.center}>
          <AppText variant="h3">{t('account.signed_out_title')}</AppText>
          <AppText color="secondary" style={styles.message}>
            {t('account.signed_out_message')}
          </AppText>
          <View style={styles.retryAction}>
            <AppButton
              accessibilityHint={t('account.signed_out_continue_hint')}
              accessibilityLabel={t('account.signed_out_continue')}
              onPress={() => {
                retry();
              }}
              title={t('account.signed_out_continue')}
              variant="primary"
            />
          </View>
        </View>
      </AppScreen>
    );
  }

  const message =
    phase === 'offline'
      ? t('errors.network_lost')
      : phase === 'merge-in-progress'
      ? t('account.merge_in_progress')
      : failureMessage ?? t('account.boot_failed');

  return (
    <AppScreen>
      <View style={styles.center}>
        <AppText variant="h3">
          {phase === 'offline' ? t('account.offline_title') : t('app.name')}
        </AppText>
        <AppText color="secondary" style={styles.message}>
          {message}
        </AppText>
        <View style={styles.retryAction}>
          <AppButton
            accessibilityHint={t('account.retry_hint')}
            accessibilityLabel={t('common.retry')}
            onPress={() => {
              retry();
            }}
            title={t('common.retry')}
            variant="primary"
          />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    textAlign: 'center',
  },
  retryAction: {
    width: 200,
  },
});
