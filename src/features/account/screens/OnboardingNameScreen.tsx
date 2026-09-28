import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {TextField} from '@ui/components/TextField';
import {validateDisplayName} from '../logic/profileValidation';
import {useAccountStore} from '../logic/useAccountStore';

/**
 * Required display-name onboarding (SETE-303 / T6, REQ-4 / VC-3).
 *
 * First install asks "how should we call you" and blocks until valid text
 * is entered. Validation mirrors the server (NFC, 1–80 code points, no
 * control characters); the normalized value is submitted with the bootstrap
 * ticket held by the account store.
 */
export function OnboardingNameScreen() {
  const {t} = useTranslation();
  const phase = useAccountStore(state => state.phase);
  const failureMessage = useAccountStore(state => state.failureMessage);
  const submitDisplayName = useAccountStore(state => state.submitDisplayName);
  const retry = useAccountStore(state => state.retry);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validation = validateDisplayName(name);
  const showError = touched && !validation.ok;
  const errorMessage = !showError
    ? undefined
    : validation.errorCode === 'TOO_LONG'
    ? t('account.name_too_long')
    : validation.errorCode === 'INVALID_CHARACTERS'
    ? t('account.name_invalid_characters')
    : t('account.name_required');

  async function handleContinue() {
    setTouched(true);
    const current = validateDisplayName(name);
    if (!current.ok || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await submitDisplayName(current.normalized);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || phase === 'bootstrapping';

  return (
    <AppScreen>
      <View style={styles.container}>
        <AppCard style={styles.card}>
          <AppText variant="h2">{t('account.onboarding_title')}</AppText>
          <AppText color="secondary">
            {t('account.onboarding_subtitle')}
          </AppText>
          <TextField
            accessibilityHint={t('account.name_field_hint')}
            accessibilityLabel={t('account.name_field_label')}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!busy}
            errorMessage={errorMessage}
            hasError={showError}
            maxLength={160}
            onChangeText={text => {
              setName(text);
              if (!touched) {
                setTouched(true);
              }
            }}
            placeholder={t('account.name_placeholder')}
            returnKeyType="done"
            value={name}
            onSubmitEditing={handleContinue}
          />
          {phase === 'failed' && failureMessage ? (
            <AppText color="danger">{failureMessage}</AppText>
          ) : null}
          {phase === 'offline' ? (
            <AppText color="secondary">{t('errors.network_lost')}</AppText>
          ) : null}
          <AppButton
            accessibilityHint={t('account.continue_hint')}
            accessibilityLabel={t('account.continue')}
            disabled={busy}
            loading={busy}
            onPress={handleContinue}
            title={t('account.continue')}
          />
          {phase === 'offline' || phase === 'failed' ? (
            <AppButton
              accessibilityHint={t('account.retry_hint')}
              accessibilityLabel={t('common.retry')}
              onPress={() => {
                retry();
              }}
              title={t('common.retry')}
              variant="secondary"
            />
          ) : null}
        </AppCard>
        <AppText color="secondary" variant="caption" style={styles.footnote}>
          {t('account.onboarding_footnote')}
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  container: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 16,
  },
  footnote: {
    textAlign: 'center',
  },
});
