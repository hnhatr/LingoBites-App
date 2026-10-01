import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSentence} from '@core/schemas/lesson';

import {
  activeSentenceIndexAt,
  formatCueTimestamp,
} from '../logic/canonicalYouTubeCues';

export type YouTubeTimelineProps = {
  sentences: LessonSentence[];
  /** Current playback position in milliseconds. */
  positionMs: number;
  /** `false` renders the unavailable-video state (no highlight, no seek). */
  videoAvailable: boolean;
  unavailableReason?: string;
  onSeek?: (positionMs: number) => void;
};

function timelineStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {gap: theme.spacing.sm},
    cue: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    cueActive: {borderColor: theme.colors.primary, borderWidth: 2},
    timestamp: {
      color: theme.colors.primary,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.bold,
    },
    cueText: {
      color: theme.colors.text.primary,
      flex: 1,
      fontSize: theme.typography.size.md,
    },
    cueTextActive: {fontWeight: theme.typography.weight.bold},
    unavailableBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      padding: theme.spacing.lg,
    },
    unavailableText: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
    },
  });
}

/**
 * YouTube cue timeline: highlights the cue containing `positionMs` and seeks
 * on tap. When the video is unavailable the cues render without highlight or
 * seek so the downloaded sentences stay readable.
 */
export function YouTubeTimeline({
  sentences,
  positionMs,
  videoAvailable,
  unavailableReason,
  onSeek,
}: YouTubeTimelineProps) {
  const {theme} = useAppTheme();
  const styles = timelineStyles(theme);
  const cued = sentences.filter(
    sentence => sentence.start_ms !== null && sentence.end_ms !== null,
  );
  if (!videoAvailable) {
    return (
      <View testID="youtube-timeline-unavailable" style={styles.unavailableBox}>
        <Text
          testID="youtube-timeline-unavailable-text"
          style={styles.unavailableText}
        >
          {unavailableReason ??
            'Video is unavailable. Sentences remain readable below.'}
        </Text>
      </View>
    );
  }
  const activeIndex =
    cued.length > 0 ? activeSentenceIndexAt(cued, positionMs) : null;
  return (
    <View testID="youtube-timeline" style={styles.container}>
      {cued.map((sentence, index) => {
        const active = activeIndex === index;
        return (
          <Pressable
            accessibilityRole="button"
            key={sentence.id}
            testID={`youtube-cue-${sentence.id}${active ? '-active' : ''}`}
            accessibilityState={{selected: active}}
            onPress={
              sentence.start_ms !== null && onSeek
                ? () => onSeek(sentence.start_ms as number)
                : undefined
            }
          >
            <View style={[styles.cue, active ? styles.cueActive : null]}>
              <Text
                testID={`youtube-cue-time-${sentence.id}`}
                style={styles.timestamp}
              >
                {sentence.start_ms !== null
                  ? formatCueTimestamp(sentence.start_ms)
                  : '--:--'}
              </Text>
              <Text
                testID={`youtube-cue-text-${sentence.id}`}
                style={[styles.cueText, active ? styles.cueTextActive : null]}
              >
                {sentence.text_en}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
