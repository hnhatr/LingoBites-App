import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {
  activeSentenceIndexAt,
  startedSentenceIndexAt,
} from '../logic/canonicalYouTubeCues';
import {sortedBlocks, sortedSentences} from '../logic/lessonHubContent';
import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {CanonicalBlockView} from './CanonicalBlockView';
import {LessonStatusBanners} from './LessonStatusBanners';
import {LessonStudyToolbar} from './LessonStudyToolbar';
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
  videoPlaying: boolean;
  showTranslation?: boolean;
  showIpa?: boolean;
  unavailableReason?: string;
  videoSlot?: React.ReactNode;
  onRetryVideo?: () => void;
  onSeek?: (positionMs: number) => void;
  /** Tapping a card pauses the video so the learner can read it. */
  onPauseVideo?: () => void;
  onRequestAnalysis?: (sentenceId: string) => void;
  onRetryAnalysis?: (sentenceId: string) => void;
  analysisStates?: Record<
    string,
    SentenceAnalysisPanelState | SentenceAnalysisPanelError
  >;
  onSpeakText?: (text: string) => void;
  vocabularySave?: VocabularySaveControl;
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
  videoPlaying,
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
}: YouTubeLessonStudyProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openSheet, setOpenSheet] = useState<OpenSheet>('none');
  const [carouselScrollAnimated, setCarouselScrollAnimated] = useState(false);
  // Cards follow the video timeline while it plays. Any manual navigation
  // (swipe, prev/next, card tap, transcript) stops following until the video
  // is played again.
  const [followVideo, setFollowVideo] = useState(true);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;

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
  const followIndex = useMemo(
    () => startedSentenceIndexAt(orderedSentences, playbackPositionMs),
    [orderedSentences, playbackPositionMs],
  );

  useEffect(() => {
    if (videoPlaying) {
      setFollowVideo(true);
    }
  }, [videoPlaying]);

  useEffect(() => {
    if (
      videoPlaying &&
      followVideo &&
      followIndex !== null &&
      followIndex !== currentIndexRef.current
    ) {
      setCarouselScrollAnimated(true);
      setCurrentIndex(followIndex);
    }
  }, [followIndex, followVideo, videoPlaying]);

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
      setFollowVideo(false);
      setCurrentIndex(index);
      if (startMs !== null) {
        onSeek?.(startMs);
      }
      setOpenSheet('none');
    },
    [onSeek],
  );

  const goPrev = useCallback(() => {
    setFollowVideo(false);
    setCarouselScrollAnimated(true);
    setCurrentIndex(index => Math.max(0, index - 1));
  }, []);

  const goNext = useCallback(() => {
    setFollowVideo(false);
    setCarouselScrollAnimated(true);
    setCurrentIndex(index => Math.min(orderedSentences.length - 1, index + 1));
  }, [orderedSentences.length]);

  const handleCarouselIndexChange = useCallback((index: number) => {
    setCarouselScrollAnimated(false);
    // Programmatic scrolls report the index we already hold; only a real
    // swipe to another card should stop following the video.
    if (index !== currentIndexRef.current) {
      setFollowVideo(false);
    }
    setCurrentIndex(index);
  }, []);

  const handleCarouselScrollAnimationConsumed = useCallback(() => {
    setCarouselScrollAnimated(false);
  }, []);

  const atFirst = currentIndex <= 0 || orderedSentences.length === 0;
  const atLast =
    orderedSentences.length === 0 ||
    currentIndex >= orderedSentences.length - 1;

  return (
    <View testID="canonical-player" style={styles.root}>
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        testID="youtube-study-scroll"
      >
        <AppText testID="youtube-study-title" variant="h3">
          {snapshot.title}
        </AppText>
        <LessonStatusBanners offline={offline} hasUpdate={hasUpdate} />

        <YouTubeSentenceCarousel
          activeIndex={activeIndex}
          analyses={mergedAnalyses}
          currentIndex={currentIndex}
          onIndexChange={handleCarouselIndexChange}
          onPauseVideo={onPauseVideo}
          onScrollAnimationConsumed={handleCarouselScrollAnimationConsumed}
          scrollAnimated={carouselScrollAnimated}
          onOpenAnalysis={handleOpenAnalysis}
          onSeek={onSeek}
          onSpeakText={onSpeakText}
          sentences={orderedSentences}
          showIpa={showIpa}
          showTranslation={showTranslation}
        />

        {orderedBlocks.map(block => (
          <CanonicalBlockView key={block.id} block={block} />
        ))}
      </ScrollView>

      <LessonStudyToolbar
        atFirst={atFirst}
        atLast={atLast}
        onNext={goNext}
        onOpenTranscript={handleOpenTranscript}
        onPrev={goPrev}
        position={orderedSentences.length === 0 ? 0 : currentIndex + 1}
        total={orderedSentences.length}
      />

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
        vocabularySave={vocabularySave}
        visible={openSheet === 'analysis' && currentSentenceId.length > 0}
      />
      <YouTubeTranscriptSheet
        activeIndex={activeIndex}
        currentIndex={currentIndex}
        onClose={handleCloseSheet}
        onSelectSentence={handleTranscriptSelect}
        sentences={orderedSentences}
        showTranslation={showTranslation}
        videoPlaying={videoPlaying}
        visible={openSheet === 'transcript'}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
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
      marginHorizontal: theme.gutter,
      minHeight: 200,
      overflow: 'hidden',
      position: 'relative',
    },
  });
}
