import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';

import type {
  LessonAnalysis,
  LessonCatalogItem,
  LessonSnapshot,
} from '@core/schemas/lesson';

import type {SentenceRepeat} from '../logic/sentenceRepeat';
import type {
  GrammarSaveControl,
  VocabularySaveControl,
} from '../logic/useLessonSavedItems';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {SentenceStudy} from './SentenceStudy';
import {
  type CurrentSentenceInfo,
  YouTubeLessonStudy,
} from './YouTubeLessonStudy';

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
  /** "Đánh dấu" on analysed grammar (text lessons); omitted = none. */
  grammarSave?: GrammarSaveControl;
  /** "Xong" after the last sentence (text lessons). */
  onFinish?: () => void;
  /** Public video (YouTube study only): its six-step lessons. */
  videoLessons?: readonly LessonCatalogItem[];
  onOpenVideoLesson?: (lessonId: string) => void;
  /** YouTube study listening controls (screen-owned). */
  onPlayVideo?: () => void;
  sentenceRepeat?: SentenceRepeat;
  playbackRate?: number;
  onCyclePlaybackRate?: () => void;
  onCurrentSentenceChange?: (current: CurrentSentenceInfo) => void;
};

/**
 * One App player for every canonical source (TASK-007 outcome): learner
 * text/OCR/YouTube and admin-created lessons all render from the same
 * snapshot body. YouTube lessons study along the video; every other source
 * goes one sentence at a time (`SentenceStudy`) with its analysis and the
 * lesson's blocks.
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
  grammarSave,
  onFinish,
  videoLessons,
  onOpenVideoLesson,
  onPlayVideo,
  sentenceRepeat,
  playbackRate,
  onCyclePlaybackRate,
  onCurrentSentenceChange,
}: CanonicalLessonPlayerProps) {
  const {t} = useTranslation();
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
        videoLessons={videoLessons}
        onOpenVideoLesson={onOpenVideoLesson}
        onPlayVideo={onPlayVideo}
        sentenceRepeat={sentenceRepeat}
        playbackRate={playbackRate}
        onCyclePlaybackRate={onCyclePlaybackRate}
        onCurrentSentenceChange={onCurrentSentenceChange}
      />
    );
  }
  return (
    <SentenceStudy
      analyses={analyses}
      analysisStates={analysisStates}
      grammarSave={grammarSave}
      hasUpdate={hasUpdate}
      lateAnalyses={lateAnalyses}
      offline={offline}
      onFinish={onFinish}
      onRequestAnalysis={onRequestAnalysis}
      onRetryAnalysis={onRetryAnalysis}
      onSpeakText={onSpeakText}
      snapshot={snapshot}
      vocabularySave={vocabularySave}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
});
