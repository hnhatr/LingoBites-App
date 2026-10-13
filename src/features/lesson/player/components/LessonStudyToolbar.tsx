import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type LessonStudyToolbarProps = {
  atFirst: boolean;
  atLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenTranscript: () => void;
  /** Replays the current sentence from its start; omitted = disabled. */
  onReplay?: () => void;
  /** Whether the video is playing: the main button shows pause, else play. */
  videoPlaying?: boolean;
  /** Toggles play/pause; omitted = disabled. */
  onTogglePlay?: () => void;
  /** Current video speed (1, 0.75, 0.5). */
  playbackRate?: number;
  /** Cycles the speed; omitted = no speed control. */
  onCyclePlaybackRate?: () => void;
};

/** "0.75×" label; whole numbers drop the decimals ("1×"). */
export function formatPlaybackRate(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(0) : String(rate)}×`;
}

/** Bottom listening controls: transcript, prev, play/pause, replay sentence, next, speed. */
export function LessonStudyToolbar({
  atFirst,
  atLast,
  onPrev,
  onNext,
  onOpenTranscript,
  onReplay,
  videoPlaying = false,
  onTogglePlay,
  playbackRate = 1,
  onCyclePlaybackRate,
}: LessonStudyToolbarProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const rateLabel = formatPlaybackRate(playbackRate);

  return (
    <View style={styles.bar} testID="youtube-study-toolbar">
      <IconButton
        accessibilityLabel={t('youtube.study.open_transcript_a11y')}
        icon="subtitles"
        onPress={onOpenTranscript}
        testID="youtube-open-transcript"
        tone="bare"
      />
      <IconButton
        accessibilityLabel={t('youtube.study.cards_prev_a11y')}
        disabled={atFirst}
        icon="chevron_left"
        onPress={onPrev}
        testID="youtube-cards-prev"
        tone="surface"
      />
      <IconButton
        accessibilityLabel={t(
          videoPlaying ? 'youtube.study.pause_a11y' : 'youtube.study.play_a11y',
        )}
        disabled={!onTogglePlay}
        icon={videoPlaying ? 'pause' : 'play_arrow'}
        iconSize={32}
        onPress={onTogglePlay}
        size={56}
        testID="youtube-toggle-play"
        tone="accent"
      />
      <IconButton
        accessibilityHint={t('youtube.study.replay_sentence_hint')}
        accessibilityLabel={t('youtube.study.replay_sentence_a11y')}
        disabled={!onReplay}
        icon="replay"
        onPress={onReplay}
        testID="youtube-replay-sentence"
        tone="surface"
      />
      <IconButton
        accessibilityLabel={t('youtube.study.cards_next_a11y')}
        disabled={atLast}
        icon="chevron_right"
        onPress={onNext}
        testID="youtube-cards-next"
        tone="surface"
      />
      {onCyclePlaybackRate ? (
        <Pressable
          accessibilityHint={t('youtube.study.playback_rate_hint')}
          accessibilityLabel={t('youtube.study.playback_rate_a11y', {
            rate: playbackRate,
          })}
          accessibilityRole="button"
          onPress={onCyclePlaybackRate}
          style={({pressed}) => [
            styles.ratePill,
            playbackRate !== 1 ? styles.ratePillActive : null,
            pressed ? styles.pressed : null,
          ]}
          testID="youtube-playback-rate"
        >
          <AppText style={styles.rateText} variant="label">
            {rateLabel}
          </AppText>
        </Pressable>
      ) : (
        <View style={styles.rateSpacer} />
      )}
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
      justifyContent: 'space-between',
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    ratePill: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 56,
      paddingHorizontal: theme.spacing.sm,
    },
    ratePillActive: {
      backgroundColor: theme.colors.accentSoft,
    },
    rateSpacer: {
      width: 56,
    },
    rateText: {
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
    },
  });
}
