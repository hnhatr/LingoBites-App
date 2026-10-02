import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {activeSentenceIndexAt} from '../logic/canonicalYouTubeCues';
import {sortedBlocks, sortedSentences} from '../logic/lessonHubContent';
import {CanonicalBlockView} from './CanonicalBlockView';
import {LessonStatusBanners} from './LessonStatusBanners';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {YouTubeAnalysisSheet} from './YouTubeAnalysisSheet';
import {YouTubeSentenceCarousel} from './YouTubeSentenceCarousel';
import {YouTubeTranscriptSheet} from './YouTubeTranscriptSheet';

export type YouTubeLessonStudyProps = {
  snapshot: LessonSnapshot;
  analyses: Record<string, LessonAnalysis>;
  lateAnalyses?: Record<string, LessonAnalysis>;
  offline?: boolean;
  hasUpdate?: boolean;
  playbackPositionMs: number;
  videoAvailable: boolean;
  unavailableReason?: string;
  videoSlot?: React.ReactNode;
  onRetryVideo?: () => void;
  onSeek?: (positionMs: number) => void;
  onRequestAnalysis?: (sentenceId: string) => void;
  onRetryAnalysis?: (sentenceId: string) => void;
  analysisStates?: Record<
    string,
    SentenceAnalysisPanelState | SentenceAnalysisPanelError
  >;
  onSpeakText?: (text: string) => void;
};

type OpenSheet = 'none' | 'analysis' | 'transcript';

export function YouTubeLessonStudy({
  snapshot,
  analyses,
  lateAnalyses,
  offline,
  hasUpdate,
  playbackPositionMs,
  videoAvailable,
  unavailableReason,
  videoSlot,
  onRetryVideo,
  onSeek,
  onRequestAnalysis,
  onRetryAnalysis,
  analysisStates,
  onSpeakText,
}: YouTubeLessonStudyProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showIpa, setShowIpa] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openSheet, setOpenSheet] = useState<OpenSheet>('none');

  const orderedSentences = useMemo(() => sortedSentences(snapshot), [snapshot]);
  const orderedBlocks = useMemo(() => sortedBlocks(snapshot), [snapshot]);
  const mergedAnalyses = useMemo(
    () => ({...analyses, ...lateAnalyses}),
    [analyses, lateAnalyses],
  );
  const activeIndex = useMemo(
    () => activeSentenceIndexAt(orderedSentences, playbackPositionMs),
    [orderedSentences, playbackPositionMs],
  );
  const handleOpenAnalysis = useCallback(
    (sentenceId: string) => {
      const hasStored =
        mergedAnalyses[sentenceId] !== undefined ||
        analyses[sentenceId] !== undefined;
      if (!offline && !hasStored && onRequestAnalysis) {
        onRequestAnalysis(sentenceId);
      }
      setOpenSheet('analysis');
    },
    [analyses, mergedAnalyses, offline, onRequestAnalysis],
  );

  const handleOpenTranscript = useCallback(() => {
    setOpenSheet('transcript');
  }, []);

  const handleCloseSheet = useCallback(() => {
    setOpenSheet('none');
  }, []);

  const currentSentence = orderedSentences[currentIndex];
  const currentSentenceId = currentSentence?.id ?? '';

  const handleTranscriptSelect = useCallback(
    (index: number, startMs: number | null) => {
      setCurrentIndex(index);
      if (startMs !== null) {
        onSeek?.(startMs);
      }
      setOpenSheet('none');
    },
    [onSeek],
  );

  const goPrev = useCallback(() => {
    setCurrentIndex(index => Math.max(0, index - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex(index => Math.min(orderedSentences.length - 1, index + 1));
  }, [orderedSentences.length]);

  const atFirst = currentIndex <= 0 || orderedSentences.length === 0;
  const atLast =
    orderedSentences.length === 0 ||
    currentIndex >= orderedSentences.length - 1;

  const progressRatio =
    orderedSentences.length === 0
      ? 0
      : (currentIndex + 1) / orderedSentences.length;

  return (
    <View testID="canonical-player" style={styles.root}>
      <View style={styles.toggleRow}>
        <IconButton
          accessibilityLabel={
            showTranslation
              ? t('youtube.translation_hide_a11y')
              : t('youtube.translation_show_a11y')
          }
          accessibilityHint={t('youtube.translation_toggle_hint')}
          icon="translate"
          onPress={() => setShowTranslation(value => !value)}
          testID="youtube-toggle-translation"
          tone={showTranslation ? 'accent' : 'ghost'}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showIpa ? t('youtube.ipa_hide_a11y') : t('youtube.ipa_show_a11y')
          }
          accessibilityState={{selected: showIpa}}
          onPress={() => setShowIpa(value => !value)}
          style={({pressed}) => [
            styles.ipaToggle,
            showIpa ? styles.ipaToggleOn : null,
            pressed ? styles.pressed : null,
          ]}
          testID="youtube-toggle-ipa"
        >
          <AppText
            style={showIpa ? styles.ipaToggleTextOn : undefined}
            variant="label"
          >
            IPA
          </AppText>
        </Pressable>
      </View>

      <LessonStatusBanners offline={offline} hasUpdate={hasUpdate} />

      <View style={styles.videoFrame}>
        {videoAvailable ? (
          videoSlot
        ) : (
          <View
            style={styles.unavailableBox}
            testID="youtube-timeline-unavailable"
          >
            <AppText
              color="secondary"
              testID="youtube-timeline-unavailable-text"
              variant="body"
            >
              {unavailableReason ?? t('lessonPlayer.video_unavailable')}
            </AppText>
            {onRetryVideo ? (
              <AppButton
                accessibilityHint={t('youtube.study.video_retry_hint')}
                onPress={onRetryVideo}
                testID="youtube-video-retry"
                title={t('youtube.study.video_retry')}
                variant="secondary"
              />
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.progressSection}>
        <AppText testID="youtube-sentence-indicator" variant="label">
          {t('lessonPlayer.sentence_counter', {
            index: orderedSentences.length === 0 ? 0 : currentIndex + 1,
            total: orderedSentences.length,
          })}
        </AppText>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: orderedSentences.length,
            now: orderedSentences.length === 0 ? 0 : currentIndex + 1,
          }}
          style={styles.progressTrack}
          testID="youtube-study-progress"
        >
          <View
            style={[styles.progressFill, {flex: progressRatio}]}
            testID="youtube-study-progress-fill"
          />
          <View style={{flex: 1 - progressRatio}} />
        </View>
      </View>

      <YouTubeSentenceCarousel
        activeIndex={activeIndex}
        analyses={mergedAnalyses}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        onOpenAnalysis={handleOpenAnalysis}
        onSeek={onSeek}
        onSpeakText={onSpeakText}
        sentences={orderedSentences}
        showIpa={showIpa}
        showTranslation={showTranslation}
      />

      <View style={styles.bottomRow}>
        <IconButton
          accessibilityLabel={t('youtube.study.cards_prev_a11y')}
          disabled={atFirst}
          icon="chevron_left"
          onPress={goPrev}
          testID="youtube-cards-prev"
          tone="surface"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('youtube.study.open_transcript_a11y')}
          onPress={handleOpenTranscript}
          style={({pressed}) => [
            styles.transcriptButton,
            pressed ? styles.pressed : null,
          ]}
          testID="youtube-sheet-transcript"
        >
          <AppText style={styles.transcriptLabel} variant="label">
            {t('youtube.study.transcript')}
          </AppText>
        </Pressable>
        <IconButton
          accessibilityLabel={t('youtube.study.cards_next_a11y')}
          disabled={atLast}
          icon="chevron_right"
          onPress={goNext}
          testID="youtube-cards-next"
          tone="surface"
        />
      </View>

      {orderedBlocks.map(block => (
        <CanonicalBlockView key={block.id} block={block} />
      ))}

      <YouTubeAnalysisSheet
        analyses={analyses}
        analysisStates={analysisStates}
        lateAnalyses={lateAnalyses}
        offline={offline}
        onClose={handleCloseSheet}
        onRequestAnalysis={onRequestAnalysis}
        onRetryAnalysis={onRetryAnalysis}
        onSpeakText={onSpeakText}
        sentenceId={currentSentenceId}
        visible={openSheet === 'analysis' && currentSentenceId.length > 0}
      />
      <YouTubeTranscriptSheet
        activeIndex={activeIndex}
        currentIndex={currentIndex}
        onClose={handleCloseSheet}
        onSelectSentence={handleTranscriptSelect}
        sentences={orderedSentences}
        showTranslation={showTranslation}
        videoAvailable={videoAvailable}
        visible={openSheet === 'transcript'}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bottomRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      justifyContent: 'center',
      paddingVertical: theme.spacing.sm,
    },
    progressFill: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      minWidth: 4,
    },
    progressSection: {
      gap: theme.spacing.xs,
    },
    progressTrack: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      height: 4,
      overflow: 'hidden',
      width: '100%',
    },
    ipaToggle: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: theme.spacing.sm,
    },
    ipaToggleOn: {
      backgroundColor: theme.colors.accentSoft,
    },
    ipaToggleTextOn: {
      color: theme.colors.primary,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    root: {
      gap: theme.spacing.md,
    },
    toggleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      justifyContent: 'flex-end',
    },
    transcriptButton: {
      alignItems: 'center',
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
    },
    transcriptLabel: {
      color: theme.colors.primary,
    },
    unavailableBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.md,
      minHeight: 200,
      padding: theme.spacing.lg,
    },
    videoFrame: {
      backgroundColor: theme.colors.surfaceLow,
      minHeight: 200,
      overflow: 'hidden',
      position: 'relative',
    },
  });
}
