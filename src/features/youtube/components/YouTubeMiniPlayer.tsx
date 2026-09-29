import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '@ui/components/AppText';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import {formatElapsed, formatSentenceLabel} from '../logic/utils/sentenceSeek';

/**
 * SETE-328 (TASK-1): mini player shown once the full player block scrolled
 * off (strictly past 50% of its height, immediately on compact screens).
 * Tapping anywhere outside its buttons scrolls back to the full player.
 * The clock polls locally so the screen itself never rerenders on a timer.
 */

const MIN_TOUCH_PT = 44;
const MINI_PROGRESS_PT = 2;
const THUMBNAIL_WIDTH = 72;
const MINI_POLL_INTERVAL_MS = 500;

export type YouTubeMiniPlayerProps = {
  videoId: string;
  activeIndex: number;
  totalSegments: number;
  durationS: number;
  getCurrentTimeS: () => Promise<number>;
  playing: boolean;
  disabled?: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  onOpenTools: () => void;
  /** Tap outside the buttons: scroll back to the full player. */
  onPress: () => void;
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.surfaceHigh,
      borderTopWidth: 1,
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.xs,
    },
    progressTrack: {
      backgroundColor: theme.colors.surfaceHigh,
      height: MINI_PROGRESS_PT,
      marginBottom: theme.spacing.xs,
    },
    progressFill: {
      backgroundColor: theme.colors.accent,
      height: MINI_PROGRESS_PT,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    thumbnail: {
      aspectRatio: 16 / 9,
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      width: THUMBNAIL_WIDTH,
    },
    info: {
      flex: 1,
    },
    button: {
      alignItems: 'center',
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: MIN_TOUCH_PT,
      minWidth: MIN_TOUCH_PT,
      paddingHorizontal: theme.spacing.xs,
    },
  });
}

export function YouTubeMiniPlayer({
  videoId,
  activeIndex,
  totalSegments,
  durationS,
  getCurrentTimeS,
  playing,
  disabled = false,
  onTogglePlay,
  onReplay,
  onOpenTools,
  onPress,
}: YouTubeMiniPlayerProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [currentS, setCurrentS] = useState(0);
  const getCurrentTimeSRef = useRef(getCurrentTimeS);
  getCurrentTimeSRef.current = getCurrentTimeS;

  useEffect(() => {
    if (disabled) {
      return undefined;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const timeS = await getCurrentTimeSRef.current();
        if (!cancelled) {
          setCurrentS(Math.max(0, timeS));
        }
      } catch {
        // Keep the last known position on bridge hiccups.
      }
    };
    poll().catch(() => undefined);
    const intervalId = setInterval(() => {
      poll().catch(() => undefined);
    }, MINI_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [disabled]);

  const progress =
    durationS > 0 ? Math.min(1, Math.max(0, currentS / durationS)) : 0;
  const infoText =
    totalSegments > 0
      ? `${formatSentenceLabel(
          Math.max(0, activeIndex),
          totalSegments,
        )} · ${formatElapsed(currentS)}`
      : formatElapsed(currentS);

  return (
    <Pressable
      accessibilityHint="Chạm để về trình phát đầy đủ"
      accessibilityLabel={`Mini player: ${infoText}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.container}
      testID="youtube-mini-player"
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${progress * 100}%`}]} />
      </View>
      <View style={styles.row}>
        <Image
          accessibilityIgnoresInvertColors
          source={{uri: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}}
          style={styles.thumbnail}
          testID="youtube-mini-thumbnail"
        />
        <AppText
          numberOfLines={1}
          style={styles.info}
          testID="youtube-mini-info"
          variant="body"
        >
          {infoText}
        </AppText>
        <Pressable
          accessibilityHint="Nghe lại câu đang phát"
          accessibilityLabel="Nghe lại"
          accessibilityRole="button"
          accessibilityState={{disabled}}
          disabled={disabled}
          onPress={onReplay}
          style={styles.button}
          testID="youtube-mini-replay"
        >
          <AppText variant="label">Nghe lại</AppText>
        </Pressable>
        <Pressable
          accessibilityHint="Phát hoặc dừng video"
          accessibilityLabel={playing ? 'Dừng' : 'Phát'}
          accessibilityRole="button"
          accessibilityState={{disabled}}
          disabled={disabled}
          onPress={onTogglePlay}
          style={styles.button}
          testID="youtube-mini-play-toggle"
        >
          <AppText variant="label">{playing ? 'Dừng' : 'Phát'}</AppText>
        </Pressable>
        <Pressable
          accessibilityHint="Mở công cụ"
          accessibilityLabel="Công cụ"
          accessibilityRole="button"
          onPress={onOpenTools}
          style={styles.button}
          testID="youtube-mini-tools"
        >
          <AppText variant="label">Công cụ</AppText>
        </Pressable>
      </View>
    </Pressable>
  );
}
