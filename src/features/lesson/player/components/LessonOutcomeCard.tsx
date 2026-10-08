import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonOutcome} from '../logic/lessonHubContent';

export type LessonOutcomeCardProps = {
  outcome: LessonOutcome;
  /** Opens a prerequisite lesson; omitted = prerequisites are plain chips. */
  onOpenLesson?: (lessonId: string) => void;
};

/**
 * "Sau bài này bạn sẽ…": the lesson's can-do statements, the situation it
 * prepares for, its length and the lessons to learn first. Tasks and criteria
 * belong to the lesson flow player, not here.
 */
export function LessonOutcomeCard({
  outcome,
  onOpenLesson,
}: LessonOutcomeCardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {situation} = outcome;
  return (
    <AppCard style={themedStyles.card} testID="lesson-outcome-card">
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <MaterialIcon color={theme.colors.primary} name="flag" size={22} />
          <AppText variant="h3">{t('lessonPlayer.outcome_title')}</AppText>
        </View>
        {outcome.canDo.map((line, index) => (
          <View key={`${index}-${line}`} style={styles.canDoRow}>
            <MaterialIcon
              color={theme.colors.primary}
              name="check_circle"
              size={18}
            />
            <AppText
              style={styles.canDoText}
              testID={`lesson-outcome-can-do-${index}`}
              variant="bodyLg"
            >
              {line}
            </AppText>
          </View>
        ))}
        {situation ? (
          <AppText color="secondary" testID="lesson-outcome-situation">
            {t('lessonPlayer.outcome_situation', {
              speaker: situation.speaker,
              listener: situation.listener,
              place: situation.place,
              purpose: situation.purpose,
            })}
          </AppText>
        ) : null}
        {outcome.estimatedMinutes ? (
          <View style={styles.titleRow}>
            <MaterialIcon
              color={theme.colors.text.muted}
              name="schedule"
              size={16}
            />
            <AppText color="muted" testID="lesson-outcome-minutes">
              {t('lessonPlayer.outcome_minutes', {
                count: outcome.estimatedMinutes,
              })}
            </AppText>
          </View>
        ) : null}
        {outcome.prerequisites.length > 0 ? (
          <View style={styles.prerequisites}>
            <AppText color="muted" variant="label">
              {t('lessonPlayer.outcome_prerequisites')}
            </AppText>
            <View style={styles.chips}>
              {outcome.prerequisites.map(prerequisite => (
                <Chip
                  key={prerequisite.lessonId}
                  accessibilityHint={
                    onOpenLesson
                      ? t('lessonPlayer.outcome_prerequisite_hint')
                      : undefined
                  }
                  label={prerequisite.title}
                  onPress={
                    onOpenLesson
                      ? () => onOpenLesson(prerequisite.lessonId)
                      : undefined
                  }
                  testID={`lesson-outcome-prerequisite-${prerequisite.lessonId}`}
                  tone="neutral"
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      borderBottomColor: theme.colors.tertiarySoft,
      borderBottomWidth: 4,
    },
  });
}

const styles = StyleSheet.create({
  body: {
    gap: 8,
  },
  canDoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  canDoText: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prerequisites: {
    gap: 4,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
