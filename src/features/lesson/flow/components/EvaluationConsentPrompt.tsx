import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

/**
 * PR 14 (T4, A12): asked the first time a spoken step-5 answer could be
 * graded. "Tự đánh giá" keeps the recording on the device; the unit's
 * summative task (PR 16) names its own way out, writing instead.
 */
export function EvaluationConsentPrompt({
  onAnswer,
  declineLabel,
}: {
  onAnswer: (agreed: boolean) => void;
  declineLabel?: string;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.box} testID="lesson-flow-evaluation-consent">
      <View style={themedStyles.title}>
        <MaterialIcon color={theme.colors.primary} name="lock" size={18} />
        <AppText variant="label">
          {t('lessonFlow.evaluation_consent_title')}
        </AppText>
      </View>
      <AppText color="secondary">
        {t('lessonFlow.evaluation_consent_body')}
      </AppText>
      <View style={themedStyles.row}>
        <AppButton
          accessibilityHint={t('lessonFlow.evaluation_consent_agree')}
          onPress={() => onAnswer(true)}
          testID="lesson-flow-evaluation-consent-agree"
          title={t('lessonFlow.evaluation_consent_agree')}
        />
        <AppButton
          accessibilityHint={
            declineLabel ?? t('lessonFlow.evaluation_consent_self')
          }
          onPress={() => onAnswer(false)}
          testID="lesson-flow-evaluation-consent-self"
          title={declineLabel ?? t('lessonFlow.evaluation_consent_self')}
          variant="outline"
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    title: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
