import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {sortedBlocks, sortedSentences} from '../logic/lessonHubContent';
import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {CanonicalBlockView} from './CanonicalBlockView';
import {LessonStatusBanners} from './LessonStatusBanners';
import {
  SentenceAnalysisPanel,
  type SentenceAnalysisPanelError,
  type SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {YouTubeLessonStudy} from './YouTubeLessonStudy';

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
  videoPlaying?: boolean;
  /** YouTube study display options (owned by the screen header toggles). */
  showTranslation?: boolean;
  showIpa?: boolean;
  unavailableReason?: string;
  /** Screen-owned YouTube iframe (AD-002); study view only. */
  videoSlot?: React.ReactNode;
  onRetryVideo?: () => void;
  onSeek?: (positionMs: number) => void;
  onPauseVideo?: () => void;
  onRequestAnalysis?: (sentenceId: string) => void;
  onRetryAnalysis?: (sentenceId: string) => void;
  /** Per-sentence async analysis state for sentences without stored analysis. */
  analysisStates?: Record<
    string,
    SentenceAnalysisPanelState | SentenceAnalysisPanelError
  >;
  /** Speaks one English sentence (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Lưu thẻ" on analysed words; omitted = no save buttons. */
  vocabularySave?: VocabularySaveControl;
};

/**
 * One App player for every canonical source (TASK-007 outcome): learner
 * text/OCR/YouTube and admin-created lessons all render from the same
 * snapshot body. Sentences show EN/VI/IPA; YouTube lessons add the cue
 * timeline; blocks render the 7 kept types; per-sentence analysis shows the
 * stored analysis or the async panel states. Styled with the Lesson Hub
 * design tokens (study cards, medallion icons, primary accents).
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
  videoPlaying = false,
  showTranslation = true,
  showIpa = true,
  unavailableReason,
  videoSlot,
  onRetryVideo,
  onSeek,
  onPauseVideo,
  onRequestAnalysis,
  onRetryAnalysis,
  analysisStates,
  onSpeakText,
  vocabularySave,
}: CanonicalLessonPlayerProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(
    snapshot.sentences[0]?.id ?? null,
  );
  const orderedSentences = useMemo(() => sortedSentences(snapshot), [snapshot]);
  const orderedBlocks = useMemo(() => sortedBlocks(snapshot), [snapshot]);
  const blockItems = useMemo(
    () =>
      new Map(
        (snapshot.lesson_items ?? []).map(entry => [entry.item.id, entry.item]),
      ),
    [snapshot],
  );
  if (archived) {
    return (
      <View testID="canonical-player-archived" style={styles.container}>
        <AppText testID="canonical-player-archived-text" color="secondary">
          {t('lessonPlayer.archived')}
        </AppText>
      </View>
    );
  }
  if (snapshot.source_type === 'youtube') {
    return (
      <YouTubeLessonStudy
        snapshot={snapshot}
        analyses={analyses}
        lateAnalyses={lateAnalyses}
        offline={offline}
        hasUpdate={hasUpdate}
        playbackPositionMs={playbackPositionMs}
        videoAvailable={videoAvailable}
        videoPlaying={videoPlaying}
        showTranslation={showTranslation}
        showIpa={showIpa}
        unavailableReason={unavailableReason}
        videoSlot={videoSlot}
        onRetryVideo={onRetryVideo}
        onSeek={onSeek}
        onPauseVideo={onPauseVideo}
        onRequestAnalysis={onRequestAnalysis}
        onRetryAnalysis={onRetryAnalysis}
        analysisStates={analysisStates}
        onSpeakText={onSpeakText}
        vocabularySave={vocabularySave}
      />
    );
  }
  return (
    <View testID="canonical-player" style={styles.container}>
      <AppText testID="canonical-player-title" variant="h2">
        {snapshot.title}
      </AppText>
      <LessonStatusBanners offline={offline} hasUpdate={hasUpdate} />
      {orderedSentences.map((sentence, index) => {
        const selected = selectedSentenceId === sentence.id;
        const stored = analyses[sentence.id] ?? lateAnalyses?.[sentence.id];
        const asyncState = analysisStates?.[sentence.id];
        const counter = t('lessonPlayer.sentence_counter', {
          index: index + 1,
          total: orderedSentences.length,
        });
        return (
          <View key={sentence.id} style={styles.sentenceGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${counter}. ${sentence.text_en}`}
              accessibilityHint={t('lessonPlayer.sentence_hint')}
              accessibilityState={{selected}}
              testID={`canonical-sentence-${sentence.id}`}
              onPress={() => {
                setSelectedSentenceId(sentence.id);
              }}
            >
              <View
                style={[
                  themedStyles.sentenceCard,
                  selected ? themedStyles.sentenceCardSelected : null,
                ]}
              >
                <View style={styles.sentenceHeader}>
                  <AppText style={themedStyles.counter} variant="label">
                    {counter}
                  </AppText>
                  {onSpeakText ? (
                    <IconButton
                      accessibilityLabel={t('lessonPlayer.speak_sentence', {
                        index: index + 1,
                      })}
                      accessibilityHint={t('lessonPlayer.speak_sentence_hint')}
                      icon="volume_up"
                      onPress={() => onSpeakText(sentence.text_en)}
                      testID={`canonical-speak-${sentence.id}`}
                      tone="ghost"
                    />
                  ) : null}
                </View>
                <AppText variant="h3">{sentence.text_en}</AppText>
                <AppText color="secondary" variant="bodyLg">
                  {sentence.text_vi}
                </AppText>
                <AppText color="muted" variant="body">
                  {sentence.ipa}
                </AppText>
              </View>
            </Pressable>
            {selected ? (
              stored ? (
                <SentenceAnalysisPanel
                  sentenceId={sentence.id}
                  state={{status: 'ready', analysis: stored}}
                  onSpeakText={onSpeakText}
                  vocabularySave={vocabularySave}
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
                  onSpeakText={onSpeakText}
                />
              ) : offline ? (
                <SentenceAnalysisPanel
                  sentenceId={sentence.id}
                  state={{status: 'offline-missing'}}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('lessonPlayer.analyze')}
                  accessibilityHint={t('lessonPlayer.analyze_hint')}
                  testID={`canonical-analyze-${sentence.id}`}
                  onPress={() => onRequestAnalysis?.(sentence.id)}
                  style={({pressed}) => [
                    themedStyles.analyzeButton,
                    pressed ? themedStyles.pressed : null,
                  ]}
                >
                  <MaterialIcon
                    color={theme.colors.primary}
                    name="auto_awesome"
                    size={18}
                  />
                  <AppText style={themedStyles.analyzeText} variant="label">
                    {t('lessonPlayer.analyze')}
                  </AppText>
                </Pressable>
              )
            ) : null}
          </View>
        );
      })}
      {orderedBlocks.map(block => (
        <CanonicalBlockView key={block.id} block={block} items={blockItems} />
      ))}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    analyzeButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
    },
    analyzeText: {
      color: theme.colors.primary,
    },
    counter: {
      color: theme.colors.primary,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    sentenceCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.lg,
    },
    sentenceCardSelected: {
      borderBottomWidth: 4,
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  sentenceGroup: {
    gap: 8,
  },
  sentenceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 24,
  },
});
