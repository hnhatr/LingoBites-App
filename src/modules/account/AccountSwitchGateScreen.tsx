import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useAccountStore} from './useAccountStore';

/**
 * P2 account-switch gate (LING-92 / FR-011): warns about local/unsynced data
 * loss and requires an exact-attempt confirm, cancel, or retry action.
 */
export function AccountSwitchGateScreen() {
  const {t} = useTranslation();
  const phase = useAccountStore(state => state.phase);
  const switchContext = useAccountStore(state => state.switchContext);
  const failureMessage = useAccountStore(state => state.failureMessage);
  const confirmSwitch = useAccountStore(state => state.confirmSwitch);
  const cancelSwitch = useAccountStore(state => state.cancelSwitch);
  const retrySwitch = useAccountStore(state => state.retrySwitch);
  const retry = useAccountStore(state => state.retry);

  if (phase === 'switching') {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <AppText color="secondary">{t('account.switching')}</AppText>
        </View>
      </AppScreen>
    );
  }

  if (phase === 'switch-failed') {
    return (
      <AppScreen>
        <View style={styles.center}>
          <AppText variant="h3">{t('account.switch_failed_title')}</AppText>
          <AppText color="secondary" style={styles.message}>
            {failureMessage ?? t('account.switch_failed_message')}
          </AppText>
          <View style={styles.actions}>
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

  if (!switchContext) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </AppScreen>
    );
  }

  const targetName =
    switchContext.targetUser.display_name ||
    switchContext.targetUser.public_code;

  return (
    <AppScreen>
      <View style={styles.center}>
        <AppText variant="h3">{t('account.switch_title')}</AppText>
        <AppText color="secondary" style={styles.message}>
          {t('account.switch_warning', {name: targetName})}
        </AppText>
        <View style={styles.actions}>
          {switchContext.needsRetry ? (
            <AppButton
              accessibilityHint={t('account.switch_retry_hint')}
              accessibilityLabel={t('account.switch_retry')}
              onPress={() => {
                retrySwitch();
              }}
              title={t('account.switch_retry')}
              variant="primary"
            />
          ) : (
            <AppButton
              accessibilityHint={t('account.switch_confirm_hint')}
              accessibilityLabel={t('account.switch_confirm')}
              onPress={() => {
                confirmSwitch();
              }}
              title={t('account.switch_confirm')}
              variant="primary"
            />
          )}
          {!switchContext.needsRetry && (
            <AppButton
              accessibilityHint={t('account.switch_cancel_hint')}
              accessibilityLabel={t('account.switch_cancel')}
              onPress={() => {
                cancelSwitch();
              }}
              title={t('account.switch_cancel')}
              variant="secondary"
            />
          )}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    width: 260,
  },
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
});
