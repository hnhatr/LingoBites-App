import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {updateAccountProfile} from '../logic/accountProfile';
import {validateDisplayName, validatePhone} from '../logic/profileValidation';
import {useAccountStore} from '../logic/useAccountStore';

function copyPublicCode(code: string): void {
  // Lazy-load the clipboard module: the native RNCClipboard TurboModule is
  // not present in every test runtime, and a static import would crash the
  // screen there instead of degrading to a no-op copy.
  try {
    const ClipboardModule = require('@react-native-clipboard/clipboard');
    const setString =
      ClipboardModule?.default?.setString ?? ClipboardModule?.setString;
    setString?.(code);
  } catch {
    // Copy is a convenience; the code stays visible for manual readout.
  }
}

/**
 * Account form for the Account settings page (SETE-303 / T6): the immutable
 * public code with copy affordance, plus display-name and optional E.164
 * phone editing. The phone is explicitly unverified lookup-only copy — the
 * app never sends a verification code to it.
 */
export function AccountProfileSection() {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const user = useAccountStore(state => state.user);
  const retry = useAccountStore(state => state.retry);
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);

  const [name, setName] = useState(user?.display_name ?? '');
  const [phone, setPhone] = useState(user?.phone_e164 ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Keep the form in sync when the account hydrates after the screen mounts
  // (boot resolves asynchronously behind the gate).
  React.useEffect(() => {
    if (user) {
      setName(current => (current === '' ? user.display_name : current));
      setPhone(current => (current === '' ? user.phone_e164 ?? '' : current));
    }
  }, [user]);

  if (!user) {
    return null;
  }

  const nameValidation = validateDisplayName(name);
  const phoneValidation = validatePhone(phone);
  const nameError =
    nameTouched && !nameValidation.ok
      ? nameValidation.errorCode === 'TOO_LONG'
        ? t('account.name_too_long')
        : nameValidation.errorCode === 'INVALID_CHARACTERS'
        ? t('account.name_invalid_characters')
        : t('account.name_required')
      : undefined;
  const phoneError =
    phoneTouched && !phoneValidation.ok
      ? t('account.phone_invalid')
      : undefined;
  const canSave =
    !saving && nameValidation.ok && phoneValidation.ok && user !== null;

  async function handleSave() {
    setNameTouched(true);
    setPhoneTouched(true);
    if (!nameValidation.ok || !phoneValidation.ok || saving) {
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const result = await updateAccountProfile({
        displayName: nameValidation.normalized,
        phone: phoneValidation.e164,
      });
      if (result.ok) {
        useAccountStore.setState({user: result.user});
        setStatus(t('account.saved'));
        return;
      }
      switch (result.errorCode) {
        case 'OFFLINE':
          setStatus(t('errors.network_lost'));
          break;
        case 'SESSION_LOST':
          await retry();
          break;
        case 'MERGE_IN_PROGRESS':
          setStatus(t('account.merge_in_progress'));
          break;
        case 'KEYCHAIN_ERROR':
          setStatus(t('account.boot_failed'));
          break;
        default:
          setStatus(result.message);
          break;
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.section}>
      <AppCard style={styles.card}>
        <View style={themedStyles.codeRow}>
          <View style={styles.codeCopy}>
            <AppText color="secondary" variant="caption">
              {t('account.public_code_label')}
            </AppText>
            <AppText
              accessibilityHint={t('account.public_code_hint')}
              accessibilityLabel={`${t('account.public_code_label')}: ${
                user.public_code
              }`}
              variant="h3"
            >
              {user.public_code}
            </AppText>
          </View>
          <Pressable
            accessibilityHint={t('account.copy_code_hint')}
            accessibilityLabel={t('account.public_code_label')}
            accessibilityRole="button"
            onPress={() => {
              copyPublicCode(user.public_code);
              setCopied(true);
            }}
            style={({pressed}) => [
              themedStyles.copyButton,
              pressed && themedStyles.pressed,
            ]}
          >
            <MaterialIcon
              color={theme.colors.accentInk}
              name="content_copy"
              size={20}
            />
          </Pressable>
        </View>
        <AppText color="secondary" variant="caption">
          {t('account.public_code_hint')}
        </AppText>
        {copied ? (
          <AppText color="secondary" variant="caption">
            {t('account.copied')}
          </AppText>
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <TextField
          accessibilityHint={t('account.name_field_hint')}
          accessibilityLabel={t('account.display_name_label')}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!saving}
          errorMessage={nameError}
          hasError={nameError !== undefined}
          label={t('account.display_name_label')}
          maxLength={160}
          onChangeText={text => {
            setName(text);
            setNameTouched(true);
          }}
          value={name}
        />
        <TextField
          accessibilityHint={t('account.phone_field_hint')}
          accessibilityLabel={t('account.phone_label')}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
          errorMessage={phoneError}
          hasError={phoneError !== undefined}
          keyboardType="phone-pad"
          label={t('account.phone_label')}
          onChangeText={text => {
            setPhone(text);
            setPhoneTouched(true);
          }}
          placeholder="+84"
          value={phone}
        />
        <AppText color="secondary" variant="caption">
          {t('account.phone_hint')}
        </AppText>
        {status ? <AppText color="secondary">{status}</AppText> : null}
        <AppButton
          accessibilityHint={t('account.save_hint')}
          accessibilityLabel={t('account.save')}
          disabled={!canSave}
          loading={saving}
          onPress={handleSave}
          title={t('account.save')}
        />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  codeCopy: {
    flex: 1,
    gap: 4,
  },
  section: {
    gap: 10,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    codeRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    copyButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
