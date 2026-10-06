import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type LessonStudyToolbarProps = {
  /** 1-based position of the current sentence (0 when there are none). */
  position: number;
  total: number;
  atFirst: boolean;
  atLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenTranscript: () => void;
};

/** Bottom bar: prev, "Câu x/y" with progress, transcript, next. */
export function LessonStudyToolbar({
  position,
  total,
  atFirst,
  atLast,
  onPrev,
  onNext,
  onOpenTranscript,
}: LessonStudyToolbarProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const progressRatio = total === 0 ? 0 : position / total;

  return (
    <View style={styles.bar} testID="youtube-study-toolbar">
      <IconButton
        accessibilityLabel={t('youtube.study.cards_prev_a11y')}
        disabled={atFirst}
        icon="chevron_left"
        onPress={onPrev}
        testID="youtube-cards-prev"
        tone="surface"
      />
      <View style={styles.center}>
        <AppText testID="youtube-sentence-indicator" variant="label">
          {t('lessonPlayer.sentence_counter', {index: position, total})}
        </AppText>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{min: 0, max: total, now: position}}
          style={styles.track}
          testID="youtube-study-progress"
        >
          <View
            style={[styles.fill, {flex: progressRatio}]}
            testID="youtube-study-progress-fill"
          />
          <View style={{flex: 1 - progressRatio}} />
        </View>
      </View>
      <IconButton
        accessibilityLabel={t('youtube.study.open_transcript_a11y')}
        icon="subtitles"
        onPress={onOpenTranscript}
        testID="youtube-open-transcript"
        tone="ghost"
      />
      <IconButton
        accessibilityLabel={t('youtube.study.cards_next_a11y')}
        disabled={atLast}
        icon="chevron_right"
        onPress={onNext}
        testID="youtube-cards-next"
        tone="surface"
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.outlineVariant,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    center: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    fill: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      minWidth: 4,
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      height: 4,
      overflow: 'hidden',
      width: '100%',
    },
  });
}
