import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {
  LessonAnalysis,
  LessonCatalogItem,
  LessonSnapshot,
} from '@core/schemas/lesson';

import {
  activeSentenceIndexAt,
  sentenceLoopEndMs,
  startedSentenceIndexAt,
} from '../logic/canonicalYouTubeCues';
import {sortedBlocks, sortedSentences} from '../logic/lessonHubContent';
import {
  bareWord,
  findVocabularyForWord,
  stripIpaDelimiters,
} from '../logic/sentenceIpa';
import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {CanonicalBlockView} from './CanonicalBlockView';
import {LessonStatusBanners} from './LessonStatusBanners';
import {LessonStudyToolbar} from './LessonStudyToolbar';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {VideoLessonsSection} from './VideoLessonsSection';
import {WordBubble} from './WordBubble';
import {YouTubeAnalysisSheet} from './YouTubeAnalysisSheet';
import {
  type SentenceWordSelection,
  YouTubeSentenceCarousel,
} from './YouTubeSentenceCarousel';
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
  /** Public video: the six-step lessons made from it, listed under it. */
  videoLessons?: readonly LessonCatalogItem[];
  onOpenVideoLesson?: (lessonId: string) => void;
  /** Resumes the video (replay sentence). */
  onPlayVideo?: () => void;
  /** Jump back to the sentence start whenever playback reaches its end. */
  loopSentence?: boolean;
  /** Current video speed, shown on the toolbar. */
  playbackRate?: number;
  onCyclePlaybackRate?: () => void;
  /** Reports the card in view so the screen header can show "Câu x/y". */
  onCurrentSentenceChange?: (current: CurrentSentenceInfo) => void;
};

export type CurrentSentenceInfo = {
  /** 1-based position (0 when the lesson has no sentences). */
  position: number;
  total: number;
  startMs: number | null;
};

/** Above this many sentences the progress strip is one continuous bar. */
const MAX_PROGRESS_SEGMENTS = 80;
/** Poll slack: loop a little before the cue end so the next line never shows. */
const LOOP_END_SLACK_MS = 150;

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
  videoLessons,
  onOpenVideoLesson,
  onPlayVideo,
  loopSentence = false,
  playbackRate = 1,
  onCyclePlaybackRate,
  onCurrentSentenceChange,
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
  const [selectedWord, setSelectedWord] =
    useState<SentenceWordSelection | null>(null);
  const [progressWidth, setProgressWidth] = useState(0);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  // Set once a loop seek is sent; cleared when playback is back inside the
  // sentence, so late position polls cannot send the seek twice.
  const loopSeekSentRef = useRef(false);

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
      !loopSentence &&
      followIndex !== null &&
      followIndex !== currentIndexRef.current
    ) {
      setCarouselScrollAnimated(true);
      setCurrentIndex(followIndex);
    }
  }, [followIndex, followVideo, loopSentence, videoPlaying]);

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
  const currentStartMs = currentSentence?.start_ms ?? null;
  const loopEndMs = useMemo(
    () => sentenceLoopEndMs(orderedSentences, currentIndex),
    [currentIndex, orderedSentences],
  );

  useEffect(() => {
    onCurrentSentenceChange?.({
      position: orderedSentences.length === 0 ? 0 : currentIndex + 1,
      total: orderedSentences.length,
      startMs: currentStartMs,
    });
  }, [
    currentIndex,
    currentStartMs,
    onCurrentSentenceChange,
    orderedSentences.length,
  ]);

  // A word bubble belongs to one card; moving to another card closes it.
  useEffect(() => {
    setSelectedWord(null);
  }, [currentIndex]);

  useEffect(() => {
    if (
      !loopSentence ||
      !videoPlaying ||
      currentStartMs === null ||
      loopEndMs === null
    ) {
      loopSeekSentRef.current = false;
      return;
    }
    if (playbackPositionMs >= loopEndMs - LOOP_END_SLACK_MS) {
      if (!loopSeekSentRef.current) {
        loopSeekSentRef.current = true;
        onSeek?.(currentStartMs);
      }
    } else {
      loopSeekSentRef.current = false;
    }
  }, [
    currentStartMs,
    loopEndMs,
    loopSentence,
    onSeek,
    playbackPositionMs,
    videoPlaying,
  ]);

  const seekToSentence = useCallback(
    (index: number) => {
      const start = orderedSentences[index]?.start_ms ?? null;
      if (start !== null) {
        onSeek?.(start);
      }
    },
    [onSeek, orderedSentences],
  );

  const handleTogglePlay = useCallback(() => {
    if (videoPlaying) onPauseVideo?.();
    else onPlayVideo?.();
  }, [onPauseVideo, onPlayVideo, videoPlaying]);

  const handleReplay = useCallback(() => {
    if (currentStartMs === null) return;
    setFollowVideo(true);
    onSeek?.(currentStartMs);
    onPlayVideo?.();
  }, [currentStartMs, onPlayVideo, onSeek]);

  const handleProgressPress = useCallback(
    (locationX: number) => {
      if (progressWidth <= 0 || orderedSentences.length === 0) return;
      const ratio = Math.max(0, Math.min(locationX / progressWidth, 0.9999));
      const index = Math.floor(ratio * orderedSentences.length);
      setFollowVideo(false);
      setCarouselScrollAnimated(true);
      setCurrentIndex(index);
      seekToSentence(index);
    },
    [orderedSentences.length, progressWidth, seekToSentence],
  );

  const handlePressWord = useCallback(
    (selection: SentenceWordSelection) => {
      setSelectedWord(previous =>
        previous?.sentenceId === selection.sentenceId &&
        previous.wordIndex === selection.wordIndex
          ? null
          : selection,
      );
      onPauseVideo?.();
    },
    [onPauseVideo],
  );

  const handleCloseWord = useCallback(() => {
    setSelectedWord(null);
  }, []);

  const bubbleVocabulary = useMemo(() => {
    if (!selectedWord) return null;
    const vocabulary = mergedAnalyses[selectedWord.sentenceId]?.vocabulary;
    return vocabulary
      ? findVocabularyForWord(selectedWord.word, vocabulary)
      : null;
  }, [mergedAnalyses, selectedWord]);

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

  // While looping, the video moves with the card so the new sentence loops.
  const goPrev = useCallback(() => {
    setFollowVideo(false);
    setCarouselScrollAnimated(true);
    const index = Math.max(0, currentIndexRef.current - 1);
    setCurrentIndex(index);
    if (loopSentence) seekToSentence(index);
  }, [loopSentence, seekToSentence]);

  const goNext = useCallback(() => {
    setFollowVideo(false);
    setCarouselScrollAnimated(true);
    const index = Math.min(
      orderedSentences.length - 1,
      currentIndexRef.current + 1,
    );
    setCurrentIndex(index);
    if (loopSentence) seekToSentence(index);
  }, [loopSentence, orderedSentences.length, seekToSentence]);

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

  const position = orderedSentences.length === 0 ? 0 : currentIndex + 1;
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

      <Pressable
        accessibilityHint={t('youtube.study.progress_a11y')}
        accessibilityLabel={t('lessonPlayer.sentence_counter', {
          index: position,
          total: orderedSentences.length,
        })}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: orderedSentences.length,
          now: position,
        }}
        hitSlop={{top: 8, bottom: 8}}
        onLayout={event => setProgressWidth(event.nativeEvent.layout.width)}
        onPress={event => handleProgressPress(event.nativeEvent.locationX)}
        style={styles.progress}
        testID="youtube-study-progress"
      >
        {orderedSentences.length > MAX_PROGRESS_SEGMENTS ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressDone,
                {flex: position / orderedSentences.length},
              ]}
            />
            <View style={{flex: 1 - position / orderedSentences.length}} />
          </View>
        ) : (
          orderedSentences.map((sentence, index) => (
            <View
              key={sentence.id}
              style={[
                styles.segment,
                index < currentIndex ? styles.segmentDone : null,
                index === currentIndex ? styles.segmentCurrent : null,
              ]}
            />
          ))
        )}
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        testID="youtube-study-scroll"
      >
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
          onPressWord={handlePressWord}
          selectedWord={selectedWord}
          onSeek={onSeek}
          onSpeakText={onSpeakText}
          sentences={orderedSentences}
          showIpa={showIpa}
          showTranslation={showTranslation}
        />

        {orderedBlocks.map(block => (
          <CanonicalBlockView key={block.id} block={block} />
        ))}

        {videoLessons && onOpenVideoLesson ? (
          <VideoLessonsSection
            lessons={videoLessons}
            onOpenLesson={onOpenVideoLesson}
          />
        ) : null}
      </ScrollView>

      {selectedWord ? (
        <View style={styles.bubbleWrap} pointerEvents="box-none">
          <WordBubble
            ipa={
              bubbleVocabulary
                ? stripIpaDelimiters(bubbleVocabulary.ipa)
                : selectedWord.ipa
            }
            onClose={handleCloseWord}
            onSpeakText={onSpeakText}
            vocabulary={bubbleVocabulary}
            vocabularySave={vocabularySave}
            word={bareWord(selectedWord.word)}
          />
        </View>
      ) : null}

      <LessonStudyToolbar
        atFirst={atFirst}
        atLast={atLast}
        onCyclePlaybackRate={onCyclePlaybackRate}
        onNext={goNext}
        onOpenTranscript={handleOpenTranscript}
        onPrev={goPrev}
        onReplay={currentStartMs !== null && onSeek ? handleReplay : undefined}
        onTogglePlay={
          (videoPlaying ? onPauseVideo : onPlayVideo)
            ? handleTogglePlay
            : undefined
        }
        playbackRate={playbackRate}
        videoPlaying={videoPlaying}
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
    bubbleWrap: {
      bottom: 88,
      left: theme.gutter,
      position: 'absolute',
      right: theme.gutter,
    },
    progress: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      height: 14,
      marginHorizontal: theme.gutter,
      marginTop: theme.spacing.xs,
    },
    progressDone: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
    },
    progressTrack: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      flex: 1,
      flexDirection: 'row',
      height: 4,
      overflow: 'hidden',
    },
    root: {
      flex: 1,
    },
    segment: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      flex: 1,
      height: 4,
    },
    segmentCurrent: {
      backgroundColor: theme.colors.primary,
      height: 6,
    },
    segmentDone: {
      backgroundColor: theme.colors.accent,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
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
      borderRadius: theme.radius.lg,
      marginHorizontal: theme.gutter,
      minHeight: 200,
      overflow: 'hidden',
      position: 'relative',
    },
  });
}
