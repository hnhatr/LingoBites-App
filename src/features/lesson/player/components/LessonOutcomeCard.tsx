import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LessonOutcome} from '../logic/lessonHubContent';

export type LessonOutcomeCardProps = {
  outcome: LessonOutcome;
  /** Opens a prerequisite lesson; omitted = prerequisites are plain chips. */
  onOpenLesson?: (lessonId: string) => void;
};

/**
 * "Sau bài này bạn sẽ…": the lesson's can-do statements, the situation it
 * prepares for and the lessons to learn first, on a white card with a sun
 * border. The length is on the hero card. Tasks and criteria
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
    <View style={themedStyles.card} testID="lesson-outcome-card">
      <View style={themedStyles.medallion}>
        <MaterialIcon color={HERO_PALETTE.ink} name="flag" size={22} />
      </View>
      <View style={styles.body}>
        <AppText style={themedStyles.label}>
          {t('lessonPlayer.outcome_title').toUpperCase()}
        </AppText>
        {outcome.canDo.map((line, index) => (
          <AppText
            key={`${index}-${line}`}
            style={themedStyles.canDo}
            testID={`lesson-outcome-can-do-${index}`}
          >
            {line}
          </AppText>
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
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // White card with a sun border so the goal stands out from the hero.
    card: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderColor: HERO_PALETTE.sun,
      borderRadius: 22,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 14,
      padding: 16,
      ...getStickerEdge(4, HERO_PALETTE.sunShelf),
    },
    medallion: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.sun,
      borderRadius: 14,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    label: {
      color: theme.colors.onTertiaryContainer,
      fontSize: 11.5,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    canDo: {
      color: theme.colors.text.primary,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 23,
    },
  });
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prerequisites: {
    gap: 4,
  },
});
