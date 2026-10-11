import React from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import {
  requestComposeSheet,
  useComposeAvailable,
} from '@features/lesson/player';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';

export type ComposeSuggestionCardProps = {
  lessonId: string;
  picks: readonly string[];
  /** Returns to the lesson, which then opens its compose sheet. */
  onOpenLesson: () => void;
};

/**
 * Plan C: after the practice, offer "Học theo 6 bước" with the practised
 * sentences already ticked. Hidden offline, when the Server does not offer
 * compose, or when there is nothing to suggest. The sheet on the lesson shows
 * the quota and lets the learner change the sentences before sending.
 */
export function ComposeSuggestionCard({
  lessonId,
  picks,
  onOpenLesson,
}: ComposeSuggestionCardProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const available = useComposeAvailable();
  const offline = useIsOffline();
  if (!available || offline || picks.length === 0) {
    return null;
  }
  return (
    <AppCard testID="practice-compose-suggestion">
      <View style={{gap: theme.spacing.sm}}>
        <AppText variant="h3">{t('practice.compose_title')}</AppText>
        <AppText color="secondary">
          {t('practice.compose_body', {count: picks.length})}
        </AppText>
        <AppButton
          accessibilityHint={t('practice.compose_hint')}
          onPress={() => {
            requestComposeSheet(lessonId, picks);
            onOpenLesson();
          }}
          testID="practice-compose-open"
          title={t('practice.compose_action')}
          variant="secondary"
        />
      </View>
    </AppCard>
  );
}
