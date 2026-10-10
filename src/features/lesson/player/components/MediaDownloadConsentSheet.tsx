import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type MediaDownloadConsentSheetProps = {
  visible: boolean;
  onChooseAuto: () => void;
  onChooseManual: () => void;
  /** "Để sau" or closing the sheet: stays undecided. */
  onLater: () => void;
};

/**
 * Asks once, on the first lesson with media, whether lesson media may be
 * downloaded for offline study. Explains what is already stored, what the
 * download costs, and where to change the choice.
 */
export function MediaDownloadConsentSheet({
  visible,
  onChooseAuto,
  onChooseManual,
  onLater,
}: MediaDownloadConsentSheetProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onLater}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityHint={t('mediaConsent.later')}
        accessibilityLabel={t('mediaConsent.close')}
        onPress={onLater}
        style={themedStyles.backdrop}
        testID="media-consent-backdrop"
      />
      <View style={themedStyles.sheet} testID="media-consent-sheet">
        <ScrollView contentContainerStyle={themedStyles.body}>
          <AppText variant="h2">{t('mediaConsent.title')}</AppText>
          <AppText color="secondary">{t('mediaConsent.body_text')}</AppText>
          <AppText color="secondary">{t('mediaConsent.body_media')}</AppText>
          <AppText color="secondary" variant="caption">
            {t('mediaConsent.body_control')}
          </AppText>
          <View style={themedStyles.choice}>
            <AppButton
              accessibilityHint={t('mediaConsent.choose_auto_caption')}
              onPress={onChooseAuto}
              testID="media-consent-auto"
              title={t('mediaConsent.choose_auto')}
            />
            <AppText color="secondary" variant="caption">
              {t('mediaConsent.choose_auto_caption')}
            </AppText>
          </View>
          <View style={themedStyles.choice}>
            <AppButton
              accessibilityHint={t('mediaConsent.choose_manual_caption')}
              onPress={onChooseManual}
              testID="media-consent-manual"
              title={t('mediaConsent.choose_manual')}
              variant="secondary"
            />
            <AppText color="secondary" variant="caption">
              {t('mediaConsent.choose_manual_caption')}
            </AppText>
          </View>
          <AppButton
            accessibilityHint={t('mediaConsent.body_control')}
            onPress={onLater}
            testID="media-consent-later"
            title={t('mediaConsent.later')}
            variant="ghost"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
    },
    body: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    choice: {
      gap: theme.spacing.xs,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      marginTop: 'auto',
      maxHeight: '85%',
    },
  });
}
