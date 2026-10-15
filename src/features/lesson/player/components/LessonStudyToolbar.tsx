import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

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
      <ToolbarButton
        accessibilityLabel={t('youtube.study.open_transcript_a11y')}
        icon="subtitles"
        onPress={onOpenTranscript}
        styles={styles}
        testID="youtube-open-transcript"
        theme={theme}
      />
      <ToolbarButton
        accessibilityLabel={t('youtube.study.cards_prev_a11y')}
        disabled={atFirst}
        icon="chevron_left"
        onPress={onPrev}
        styles={styles}
        testID="youtube-cards-prev"
        theme={theme}
      />
      <Pressable
        accessibilityLabel={t(
          videoPlaying ? 'youtube.study.pause_a11y' : 'youtube.study.play_a11y',
        )}
        accessibilityRole="button"
        accessibilityState={{disabled: !onTogglePlay}}
        disabled={!onTogglePlay}
        onPress={onTogglePlay}
        style={({pressed}) => [
          styles.play,
          pressed ? styles.playPressed : null,
          !onTogglePlay ? styles.disabled : null,
        ]}
        testID="youtube-toggle-play"
      >
        <MaterialIcon
          color={HERO_PALETTE.tealInk}
          name={videoPlaying ? 'pause' : 'play_arrow'}
          size={34}
        />
      </Pressable>
      <ToolbarButton
        accessibilityHint={t('youtube.study.replay_sentence_hint')}
        accessibilityLabel={t('youtube.study.replay_sentence_a11y')}
        disabled={!onReplay}
        icon="replay"
        onPress={onReplay}
        styles={styles}
        testID="youtube-replay-sentence"
        theme={theme}
      />
      <ToolbarButton
        accessibilityLabel={t('youtube.study.cards_next_a11y')}
        disabled={atLast}
        icon="chevron_right"
        onPress={onNext}
        styles={styles}
        testID="youtube-cards-next"
        theme={theme}
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
            styles.button,
            styles.ratePill,
            playbackRate !== 1 ? styles.ratePillActive : null,
            pressed ? styles.buttonPressed : null,
          ]}
          testID="youtube-playback-rate"
        >
          <AppText
            style={[
              styles.rateText,
              playbackRate !== 1 ? styles.rateTextActive : null,
            ]}
            variant="label"
          >
            {rateLabel}
          </AppText>
        </Pressable>
      ) : (
        <View style={styles.rateSpacer} />
      )}
    </View>
  );
}

type ToolbarButtonProps = {
  icon: HandoffIconName;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  onPress?: () => void;
  testID: string;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
};

/** White sticker square used for every secondary toolbar control. */
function ToolbarButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  onPress,
  testID,
  styles,
  theme,
}: ToolbarButtonProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        pressed ? styles.buttonPressed : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      <MaterialIcon color={theme.colors.primary} name={icon} size={22} />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.surfaceHigh,
      borderTopWidth: StyleSheet.hairlineWidth * 2,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    button: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      height: 46,
      justifyContent: 'center',
      width: 46,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    buttonPressed: {
      transform: [{translateY: 2}],
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
    play: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: 33,
      height: 66,
      justifyContent: 'center',
      width: 66,
      ...getStickerEdge(5, HERO_PALETTE.shelf),
    },
    playPressed: {
      transform: [{translateY: 3}],
    },
    ratePill: {
      minWidth: 52,
      paddingHorizontal: theme.spacing.sm,
      width: undefined,
    },
    ratePillActive: {
      backgroundColor: theme.colors.tertiarySoft,
      ...getStickerEdge(3, theme.colors.tertiaryBorder),
    },
    rateSpacer: {
      width: 52,
    },
    rateText: {
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    rateTextActive: {
      color: theme.colors.onTertiaryContainer,
    },
  });
}
