import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  type DimensionValue,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
  StyleSheet,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  formatRemaining,
  formatSentenceLabel,
  snapSeekToSentence,
} from '../logic/utils/sentenceSeek';

/**
 * SETE-328 (TASK-1): compact control bar pinned under the 16:9 frame.
 * Always visible, never auto-hides.
 *
 * The seek track is responder-driven (no extra dependency): drag or tap to
 * scrub, release to commit. On release the position snaps to the nearest
 * sentence start within ±0.4s and reuses the merged `seekToIndex` path
 * (with its -0.3s compensation); positions outside snap range seek raw.
 */

const MIN_TOUCH_PT = 44;
const SCRUB_POLL_INTERVAL_MS = 500;

export type ControlBarSegment = {
  start_ms: number;
  end_ms: number;
};

export type CompactControlBarProps = {
  segments: readonly ControlBarSegment[];
  activeIndex: number;
  durationS: number;
  getCurrentTimeS: () => Promise<number>;
  playing: boolean;
  toolsArmed: boolean;
  disabled?: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  onOpenTools: () => void;
  onSeekToIndex: (index: number) => void;
  onSeekToSeconds: (seconds: number) => void;
  abLoopStartIndex?: number | null;
  abLoopEndIndex?: number | null;
  abLoopActive?: boolean;
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.xs,
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      height: 28,
      justifyContent: 'center',
      width: '100%',
    },
    fill: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      height: 4,
    },
    thumb: {
      backgroundColor: theme.colors.accentInk,
      borderRadius: theme.radius.pill,
      height: 12,
      position: 'absolute',
      width: 12,
    },
    tick: {
      backgroundColor: theme.colors.text.muted,
      height: 8,
      position: 'absolute',
      width: 2,
    },
    abRangeHighlight: {
      backgroundColor: theme.colors.accent,
      height: 6,
      opacity: 0.35,
      position: 'absolute',
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    sentenceLabel: {
      minWidth: 76,
    },
    button: {
      alignItems: 'center',
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: MIN_TOUCH_PT,
      minWidth: MIN_TOUCH_PT,
      paddingHorizontal: theme.spacing.sm,
    },
    buttonArmed: {
      borderColor: theme.colors.accent,
    },
    remain: {
      flex: 1,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
  });
}

export function CompactControlBar({
  segments,
  activeIndex,
  durationS,
  getCurrentTimeS,
  playing,
  toolsArmed,
  disabled = false,
  onTogglePlay,
  onReplay,
  onOpenTools,
  onSeekToIndex,
  onSeekToSeconds,
  abLoopStartIndex = null,
  abLoopEndIndex = null,
  abLoopActive = false,
}: CompactControlBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [currentS, setCurrentS] = useState(0);
  const [scrubS, setScrubS] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const scrubbingRef = useRef(false);
  const getCurrentTimeSRef = useRef(getCurrentTimeS);
  getCurrentTimeSRef.current = getCurrentTimeS;

  useEffect(() => {
    if (disabled) {
      return undefined;
    }
    let cancelled = false;
    const poll = async () => {
      if (scrubbingRef.current) {
        return;
      }
      try {
        const timeS = await getCurrentTimeSRef.current();
        if (!cancelled) {
          setCurrentS(Math.max(0, timeS));
        }
      } catch {
        // Bridge hiccups keep the last known position; the transcript sync
        // hook owns retry semantics.
      }
    };
    poll().catch(() => undefined);
    const intervalId = setInterval(() => {
      poll().catch(() => undefined);
    }, SCRUB_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [disabled]);

  const shownS = scrubS ?? currentS;
  const fraction =
    durationS > 0 ? Math.min(1, Math.max(0, shownS / durationS)) : 0;

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const scrubToNativeX = (nativeX: number) => {
    if (trackWidth <= 0 || durationS <= 0) {
      return;
    }
    const next = Math.min(1, Math.max(0, nativeX / trackWidth)) * durationS;
    setScrubS(next);
  };

  const handleResponderGrant = (
    event: NativeSyntheticEvent<NativeTouchEvent>,
  ) => {
    scrubbingRef.current = true;
    scrubToNativeX(event.nativeEvent.locationX);
  };

  const handleResponderMove = (
    event: NativeSyntheticEvent<NativeTouchEvent>,
  ) => {
    scrubToNativeX(event.nativeEvent.locationX);
  };

  const handleResponderRelease = () => {
    scrubbingRef.current = false;
    setScrubS(current => {
      if (current == null) {
        return current;
      }
      const snapped = snapSeekToSentence(current, segments);
      const snappedIndex = segments.findIndex(
        segment => segment.start_ms / 1000 === snapped,
      );
      if (snappedIndex >= 0) {
        onSeekToIndex(snappedIndex);
      } else {
        onSeekToSeconds(snapped);
      }
      return null;
    });
  };

  const seekable = !disabled && durationS > 0;

  // SETE-346 (Option C): the compact seek keeps the A–B range highlight
  // after the Tools sheet stops duplicating the seek track.
  const abHighlightStyle: {left: DimensionValue; width: DimensionValue} | null =
    abLoopActive &&
    abLoopStartIndex != null &&
    abLoopEndIndex != null &&
    durationS > 0 &&
    segments[abLoopStartIndex] != null &&
    segments[abLoopEndIndex] != null
      ? {
          left: `${
            (segments[abLoopStartIndex].start_ms / 1000 / durationS) * 100
          }%` as DimensionValue,
          width: `${Math.max(
            0,
            ((segments[abLoopEndIndex].end_ms -
              segments[abLoopStartIndex].start_ms) /
              1000 /
              durationS) *
              100,
          )}%` as DimensionValue,
        }
      : null;

  return (
    <View style={styles.container} testID="youtube-compact-bar">
      <View
        accessibilityActions={[
          {name: 'increment', label: 'Câu sau'},
          {name: 'decrement', label: 'Câu trước'},
        ]}
        accessibilityHint="Chạm hoặc vuốt để tua tới câu"
        accessibilityLabel="Thanh tua theo câu"
        accessibilityRole="adjustable"
        accessibilityValue={{
          text:
            segments.length > 0
              ? formatSentenceLabel(Math.max(0, activeIndex), segments.length)
              : 'Câu –/–',
        }}
        onAccessibilityAction={event => {
          if (disabled || segments.length === 0) return;
          if (event.nativeEvent.actionName === 'increment') {
            const next = Math.min(
              segments.length - 1,
              Math.max(0, activeIndex) + 1,
            );
            onSeekToIndex(next);
          } else if (event.nativeEvent.actionName === 'decrement') {
            const prev = Math.max(0, activeIndex - 1);
            onSeekToIndex(prev);
          }
        }}
        onLayout={handleTrackLayout}
        onResponderGrant={handleResponderGrant}
        onResponderMove={handleResponderMove}
        onResponderRelease={handleResponderRelease}
        onStartShouldSetResponder={() => seekable}
        testID="youtube-compact-seek"
        style={styles.track}
      >
        {abHighlightStyle ? (
          <View style={[styles.abRangeHighlight, abHighlightStyle]} />
        ) : null}
        <View style={[styles.fill, {width: `${fraction * 100}%`}]} />
        {segments.map(
          (segment, index) =>
            durationS > 0 && (
              <View
                key={`${segment.start_ms}-${index}`}
                style={[
                  styles.tick,
                  {
                    left: `${(segment.start_ms / 1000 / durationS) * 100}%`,
                  },
                ]}
              />
            ),
        )}
        <View style={[styles.thumb, {left: `${fraction * 100}%`}]} />
      </View>
      <View style={styles.row}>
        <AppText
          style={styles.sentenceLabel}
          testID="youtube-compact-label"
          variant="label"
        >
          {segments.length > 0
            ? formatSentenceLabel(Math.max(0, activeIndex), segments.length)
            : 'Câu –/–'}
        </AppText>
        <IconButton
          accessibilityHint="Phát hoặc dừng video"
          accessibilityLabel={playing ? 'Dừng' : 'Phát'}
          disabled={disabled}
          icon={playing ? 'pause' : 'play_arrow'}
          onPress={onTogglePlay}
          style={styles.button}
          testID="youtube-compact-play-toggle"
          tone="surface"
        />
        <IconButton
          accessibilityHint="Nghe lại câu đang phát"
          accessibilityLabel="Nghe lại"
          disabled={disabled}
          icon="replay"
          onPress={onReplay}
          style={styles.button}
          testID="youtube-compact-replay"
          tone="surface"
        />
        <AppText
          color="secondary"
          style={styles.remain}
          testID="youtube-compact-remaining"
          variant="body"
        >
          {formatRemaining(durationS, shownS)}
        </AppText>
        <IconButton
          accessibilityHint="Mở công cụ"
          accessibilityLabel="Công cụ"
          icon="settings"
          onPress={onOpenTools}
          style={[styles.button, toolsArmed && styles.buttonArmed]}
          testID="youtube-compact-tools"
          tone={toolsArmed ? 'accent' : 'surface'}
        />
      </View>
    </View>
  );
}
