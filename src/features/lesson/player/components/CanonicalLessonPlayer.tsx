import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {CanonicalBlockView} from './CanonicalBlockView';
import {
  SentenceAnalysisPanel,
  type SentenceAnalysisPanelError,
  type SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {YouTubeTimeline} from './YouTubeTimeline';

export type CanonicalLessonPlayerProps = {
  snapshot: LessonSnapshot;
  /** Stored analyses from the snapshot body (download time only, AD-005). */
  analyses: Record<string, LessonAnalysis>;
  /** Fetched after download; display-only, never merged into storage. */
  lateAnalyses?: Record<string, LessonAnalysis>;
  /** True when the snapshot came from the offline download row. */
  offline?: boolean;
  /** Higher-than-stored revision seen by the status check ("có bản mới"). */
  hasUpdate?: boolean;
  /** Permanently gone (archived): player shows the archived state. */
  archived?: boolean;
  /** Current YouTube playback position in ms (YouTube lessons only). */
  playbackPositionMs?: number;
  videoAvailable?: boolean;
  unavailableReason?: string;
  onSeek?: (positionMs: number) => void;
  onRequestAnalysis?: (sentenceId: string) => void;
  onRetryAnalysis?: (sentenceId: string) => void;
  /** Per-sentence async analysis state for sentences without stored analysis. */
  analysisStates?: Record<
    string,
    SentenceAnalysisPanelState | SentenceAnalysisPanelError
  >;
};

function playerStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {gap: theme.spacing.md},
    title: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.xl,
      fontWeight: theme.typography.weight.bold,
    },
    meta: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
    },
    updateBanner: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      padding: theme.spacing.md,
    },
    updateText: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.bold,
    },
    sentence: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    sentenceSelected: {borderColor: theme.colors.primary, borderWidth: 2},
    sentenceEn: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.bold,
    },
    sentenceVi: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
    },
    sentenceIpa: {
      color: theme.colors.text.muted,
      fontSize: theme.typography.size.sm,
    },
    analyze: {color: theme.colors.primary, fontSize: theme.typography.size.sm},
  });
}

/**
 * One App player for every canonical source (TASK-007 outcome): learner
 * text/OCR/YouTube and admin-created lessons all render from the same
 * snapshot body. Sentences show EN/VI/IPA; YouTube lessons add the cue
 * timeline; blocks render the 7 kept types; per-sentence analysis shows the
 * stored analysis or the async panel states.
 */
export function CanonicalLessonPlayer({
  snapshot,
  analyses,
  lateAnalyses,
  offline,
  hasUpdate,
  archived,
  playbackPositionMs = 0,
  videoAvailable = true,
  unavailableReason,
  onSeek,
  onRequestAnalysis,
  onRetryAnalysis,
  analysisStates,
}: CanonicalLessonPlayerProps) {
  const {theme} = useAppTheme();
  const styles = playerStyles(theme);
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(
    snapshot.sentences[0]?.id ?? null,
  );
  if (archived) {
    return (
      <View testID="canonical-player-archived" style={styles.container}>
        <Text testID="canonical-player-archived-text" style={styles.meta}>
          This lesson is no longer available.
        </Text>
      </View>
    );
  }
  const isYouTube = snapshot.source_type === 'youtube';
  const orderedSentences = [...snapshot.sentences].sort(
    (a, b) => a.position - b.position,
  );
  const orderedBlocks = [...snapshot.blocks].sort(
    (a, b) => a.position - b.position,
  );
  return (
    <View testID="canonical-player" style={styles.container}>
      <Text testID="canonical-player-title" style={styles.title}>
        {snapshot.title}
      </Text>
      <Text testID="canonical-player-meta" style={styles.meta}>
        {`${snapshot.origin} · ${snapshot.source_type} · revision ${snapshot.content_revision}`}
      </Text>
      {offline ? (
        <Text testID="canonical-player-offline" style={styles.meta}>
          Offline copy
        </Text>
      ) : null}
      {hasUpdate ? (
        <View testID="canonical-player-update" style={styles.updateBanner}>
          <Text style={styles.updateText}>Có bản mới</Text>
        </View>
      ) : null}
      {isYouTube ? (
        <YouTubeTimeline
          sentences={orderedSentences}
          positionMs={playbackPositionMs}
          videoAvailable={videoAvailable}
          unavailableReason={unavailableReason}
          onSeek={onSeek}
        />
      ) : null}
      {orderedSentences.map((sentence, index) => {
        const selected = selectedSentenceId === sentence.id;
        const stored = analyses[sentence.id] ?? lateAnalyses?.[sentence.id];
        const asyncState = analysisStates?.[sentence.id];
        return (
          <View key={sentence.id}>
            <Pressable
              accessibilityRole="button"
              testID={`canonical-sentence-${sentence.id}`}
              onPress={() => {
                setSelectedSentenceId(sentence.id);
                if (isYouTube && sentence.start_ms !== null) {
                  onSeek?.(sentence.start_ms);
                }
              }}
            >
              <View
                style={[
                  styles.sentence,
                  selected ? styles.sentenceSelected : null,
                ]}
              >
                <Text style={styles.sentenceEn}>{sentence.text_en}</Text>
                <Text style={styles.sentenceVi}>{sentence.text_vi}</Text>
                <Text style={styles.sentenceIpa}>{sentence.ipa}</Text>
                <Text style={styles.meta}>{`Câu ${index + 1}/${
                  orderedSentences.length
                }`}</Text>
              </View>
            </Pressable>
            {selected ? (
              stored ? (
                <SentenceAnalysisPanel
                  sentenceId={sentence.id}
                  state={{status: 'ready', analysis: stored}}
                />
              ) : asyncState ? (
                <SentenceAnalysisPanel
                  sentenceId={sentence.id}
                  state={asyncState}
                  onRetry={
                    onRetryAnalysis
                      ? () => onRetryAnalysis(sentence.id)
                      : undefined
                  }
                />
              ) : offline ? (
                <SentenceAnalysisPanel
                  sentenceId={sentence.id}
                  state={{status: 'offline-missing'}}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  testID={`canonical-analyze-${sentence.id}`}
                  onPress={() => onRequestAnalysis?.(sentence.id)}
                >
                  <Text style={styles.analyze}>Phân tích</Text>
                </Pressable>
              )
            ) : null}
          </View>
        );
      })}
      {orderedBlocks.map(block => (
        <CanonicalBlockView key={block.id} block={block} />
      ))}
    </View>
  );
}
