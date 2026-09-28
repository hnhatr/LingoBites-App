import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {AppButton} from '@components/AppButton';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {IconButton} from '@components/IconButton';
import {ScreenHeader} from '@components/ScreenHeader';
import {useAppTheme, type AppTheme} from '@theme';
import type {YouTubeSegment, YouTubeTranscript} from '../youtubeTranscriptPort';
import {
  clearYouTubeProgress,
  getYouTubeLesson,
  getYouTubeProgress,
  saveYouTubeProgress,
} from '../youtubeQueryPort';
import {
  YouTubePlayer,
  type YouTubePlayerErrorCode,
  type YouTubePlayerRef,
} from '../components/YouTubePlayer';

function getPlayerErrorMessage(
  error: YouTubePlayerErrorCode,
  t: (key: string, options?: any) => string,
): string {
  switch (error) {
    case 'YOUTUBE_VIDEO_NOT_FOUND':
      return t('youtube.error_video_not_found', {
        defaultValue: 'Video không tồn tại hoặc đã bị xóa.',
      });
    case 'YOUTUBE_NOT_EMBEDDABLE':
      return t('youtube.error_not_embeddable', {
        defaultValue: 'Video không cho phép phát nhúng bên ngoài YouTube.',
      });
    case 'YOUTUBE_INVALID_URL':
      return t('youtube.error_invalid_url', {
        defaultValue: 'Đường dẫn video không hợp lệ.',
      });
    case 'YOUTUBE_PLAYER_HTML5_ERROR':
      return t('youtube.error_html5', {
        defaultValue: 'Trình phát video gặp sự cố HTML5.',
      });
    default:
      return t('youtube.player_error', {
        defaultValue: 'Video gặp sự cố khi phát. Vui lòng thử lại sau.',
      });
  }
}
import {CompactControlBar} from '../components/CompactControlBar';
import {YouTubeMiniPlayer} from '../components/YouTubeMiniPlayer';
import {shouldShowMiniPlayer} from '../utils/sentenceSeek';
import {
  SentenceCarousel,
  type SentenceCarouselRef,
} from '../sentence/SentenceCarousel';
import type {SentenceCardSegment} from '../sentence/SentenceCard';
import type {
  GrammarPoint,
  SentenceEnrichment,
  VocabEntry,
} from '@shared/schemas/sentence-contract';
import {useLessonEnrichment} from '../sentence/useLessonEnrichment';
import type {RetryBlockFn} from '../sentence/useSentenceEnrichment';
import {YouTubeTranscriptPopup} from './YouTubeTranscriptPopup';
import {YouTubeToolsPopup} from './YouTubeToolsPopup';
import {speak} from '@modules/audio';
import {
  useTranscriptSync,
  TRANSCRIPT_SYNC_POLL_INTERVAL_MS,
} from '../sync/useTranscriptSync';
import {
  abWrap,
  formatLoopLabel,
  toolsBadgeActive,
  TOAST_DURATION_MS,
  type SentenceLoopCount,
} from '../utils/toolsLogic';
import type {NavigationProp} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {
  CreateStackParamList,
  RootStackParamList,
  RootTabParamList,
} from '@modules/input';
import {useFloatingTabBarClearance} from '@components/layout';
import {useBookmarkOptimistic, useFlashcardLibrary} from '@modules/review';
import {mapTranscriptToPractice} from '../utils/practiceMapper';
import type {YouTubePlaybackRate} from '../utils/playbackRate';

export type YouTubeLessonScreenProps = {
  lesson: YouTubeTranscript;
  onBack?: () => void;
  onStartPractice?: () => void;
  /**
   * SETE-283 (HVB-07): the lesson opened even though the local save failed.
   * Shows a persistent not-saved warning instead of any saved state.
   */
  saveWarning?: boolean;
  /**
   * SETE-325 (C-3): when set, each line shows a mic button that reports
   * the tapped sentence (the route screen navigates it to SpeakingRoom).
   * The route screen owns navigation, so this screen only forwards taps.
   */
  onPracticeSentence?: (segment: YouTubeSegment) => void;
  level?: string | null;
  enrichmentMap?: Record<number, SentenceEnrichment | null>;
  retryBlock?: RetryBlockFn;
  testID?: string;
};

/** Runs an async side effect without returning its promise to the caller. */
function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    headerBtn: {
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
    },
    headerBtnActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    playerWrap: {
      backgroundColor: theme.colors.surface,
    },
    playerControls: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      justifyContent: 'center',
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    errorBanner: {
      gap: theme.spacing.xs,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    saveWarningBanner: {
      gap: theme.spacing.xs,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    offlineBanner: {
      gap: theme.spacing.xs,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    bannerTextWrap: {
      gap: theme.spacing.xs / 2,
    },
    bannerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    adBanner: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      justifyContent: 'center',
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.xs,
    },
    completedBanner: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.sm,
      marginHorizontal: theme.gutter,
      marginVertical: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    completedTitle: {
      textAlign: 'center',
    },
    completedButtonsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      justifyContent: 'center',
    },
    list: {
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    miniWrap: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
    },
    notFoundWrap: {
      flex: 1,
      justifyContent: 'center',
      padding: theme.gutter,
    },
    dotsContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      paddingVertical: theme.spacing.xs,
    },
    dot: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    dotActive: {
      backgroundColor: theme.colors.accent,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    backChip: {
      alignSelf: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      bottom: theme.spacing.md,
      elevation: 4,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      position: 'absolute',
      shadowColor: theme.colors.text.primary,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 4,
      zIndex: 10,
    },
    toast: {
      alignSelf: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      elevation: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      position: 'absolute',
      shadowColor: theme.colors.text.primary,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
      top: theme.spacing.xs,
      zIndex: 20,
    },
  });
}

export function YouTubeLessonScreen({
  lesson,
  onBack,
  onStartPractice,
  saveWarning = false,
  onPracticeSentence,
  level,
  enrichmentMap,
  retryBlock,
  testID,
}: YouTubeLessonScreenProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const feedClearance = useFloatingTabBarClearance();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const playerRef = useRef<YouTubePlayerRef>(null);
  const listRef = useRef<SentenceCarouselRef>(null);
  const prevActiveIndexRef = useRef(-1);
  /**
   * SETE-345: sentence a loop replay was last issued for. A boundary
   * crossing can reach the loop effect twice (50ms tick estimate, then
   * the confirming 250ms poll). While a replay for `previous` is still
   * unconfirmed, a repeated `previous → previous+1` step is the same
   * completion, not a new one — replaying again would burn two loop
   * counts per iteration. Cleared once the replay arrival is observed
   * (observedIndex back on the replayed sentence) or a manual hop
   * supersedes it.
   */
  const replayPendingRef = useRef<number | null>(null);

  const [showVietnamese, setShowVietnamese] = useState(true);
  const [showIpa, setShowIpa] = useState(true);
  const [loopCount, setLoopCount] = useState<SentenceLoopCount>(1);
  const loopLeftRef = useRef<SentenceLoopCount>(1);
  const [abLoopStartIndex, setAbLoopStartIndex] = useState<number | null>(null);
  const [abLoopEndIndex, setAbLoopEndIndex] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState<YouTubePlaybackRate>(1);
  const [isToolsPopupOpen, setIsToolsPopupOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCardScrolledDown, setIsCardScrolledDown] = useState(false);

  const internalEnrichmentMap = useLessonEnrichment({
    videoId: lesson?.video?.id,
    segments: lesson?.segments,
    enrichmentMap,
  });

  // SETE-346 (Option A): playback controls live only in the Tools sheet,
  // so the header holds exactly 3 controls (VI, IPA, Practice).
  // SETE-325 (C-4): transcript popup visibility.
  const [isTranscriptPopupOpen, setIsTranscriptPopupOpen] = useState(false);
  const [playerError, setPlayerError] = useState<YouTubePlayerErrorCode | null>(
    null,
  );
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // SETE-328 (TASK-1): player shell state. `playing` mirrors the native
  // player (frame taps included) via onPlayingChange; `durationS` starts
  // from lesson metadata and upgrades to the real media duration on ready.
  const windowHeightPt = useWindowDimensions().height;
  const [playing, setPlaying] = useState(false);
  const [durationS, setDurationS] = useState(lesson.video.duration_seconds);
  const [playerBlockHeight, setPlayerBlockHeight] = useState(0);
  const [miniVisible, setMiniVisible] = useState(false);

  // A player error (e.g. no network / airplane mode) switches the screen to
  // offline reading mode: the cached EN + VI + IPA transcript stays fully
  // readable while every playback-dependent control is disabled.
  const isOfflineReading = playerError != null;

  // SETE-290 (DEV-2/DEV-4): a toggle must never present itself as on while
  // its content is empty — partial enrichment is a failed job upstream, but
  // the UI still fails closed for any lesson that carries empty fields.
  const hasVietnamese = lesson.segments.some(segment => segment.vi !== '');
  const hasIpa = lesson.segments.some(segment => segment.ipa !== '');
  const showVietnameseEffective = showVietnamese && hasVietnamese;
  const showIpaEffective = showIpa && hasIpa;

  const {vocabularySaveState, onVocabularySave, onVocabularyUnsave} =
    useBookmarkOptimistic(lesson.video.id);
  const {listFlashcards} = useFlashcardLibrary();
  const [savedVocabularyIds, setSavedVocabularyIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const saved = listFlashcards({lessonId: lesson.video.id}).map(
      c => c.vocabularyId,
    );
    setSavedVocabularyIds(new Set(saved));
  }, [lesson.video.id, listFlashcards]);

  const handleSeek = useCallback((timeMs: number) => {
    playerRef.current?.seekTo(timeMs / 1000);
  }, []);

  const getCurrentTimeMs = useCallback(async () => {
    const seconds = await playerRef.current?.getCurrentTime();
    return (seconds ?? 0) * 1000;
  }, []);

  // SETE-290 (DEV-3): resume progress — timestamp + active sentence, saved
  // per video and surviving app restarts. Reopening seeks to the saved
  // position but stays paused; the user presses Play to continue. Unsaved
  // lessons (saveWarning) never persist progress.
  const progressEnabled = !saveWarning;
  const [resume] = useState(() =>
    progressEnabled ? getYouTubeProgress(lesson.video.id) : null,
  );
  const progressRef = useRef({
    positionMs: resume?.positionMs ?? 0,
    segmentIndex: resume?.segmentIndex ?? 0,
  });

  const persistProgress = useCallback(() => {
    if (!progressEnabled) {
      return;
    }
    const {positionMs, segmentIndex} = progressRef.current;
    // Never create a row for a lesson that was opened but never played.
    if (
      positionMs <= 0 &&
      segmentIndex <= 0 &&
      getYouTubeProgress(lesson.video.id) == null
    ) {
      return;
    }
    saveYouTubeProgress({
      lessonId: lesson.video.id,
      positionMs,
      segmentIndex,
    });
  }, [lesson.video.id, progressEnabled]);

  const handlePlayerReady = useCallback(() => {
    if (resume && resume.positionMs > 0) {
      playerRef.current?.seekTo(resume.positionMs / 1000);
    }
    // SETE-328: upgrade the seek bar to the real media duration.
    const refreshDuration = async () => {
      try {
        const duration = await playerRef.current?.getDuration();
        if (duration != null && duration > 0) {
          setDurationS(duration);
        }
      } catch {
        // Keep the lesson metadata fallback.
      }
    };
    fireAndForget(refreshDuration());
  }, [resume]);

  const handlePlayingChange = useCallback((nextPlaying: boolean) => {
    setPlaying(nextPlaying);
  }, []);

  const handlePlayerEnded = useCallback(() => {
    // Completed: show completed banner, the next open starts from 0:00, first sentence, paused.
    setIsCompleted(true);
    setPlaying(false);
    progressRef.current = {positionMs: 0, segmentIndex: 0};
    if (progressEnabled) {
      clearYouTubeProgress(lesson.video.id);
    }
  }, [lesson.video.id, progressEnabled]);

  const {activeIndex, observedIndex, seekToIndex} = useTranscriptSync({
    segments: lesson.segments,
    getCurrentTimeMs,
    onSeek: handleSeek,
    enabled: !isOfflineReading && !isAdPlaying,
  });

  const handleSeekToIndex = useCallback(
    (index: number) => {
      prevActiveIndexRef.current = index;
      // SETE-345: a manual hop supersedes any unconfirmed loop replay.
      replayPendingRef.current = null;
      loopLeftRef.current = loopCount;
      // SETE-345: while a sentence loop is armed, manual hops seek
      // exactly to start_ms. A compensated seek would land inside the
      // previous sentence and the loop effect would mistake the
      // recovery step for a finished sentence and yank the user back.
      seekToIndex(index, loopCount > 1 ? {exact: true} : undefined);
    },
    [loopCount, seekToIndex],
  );

  const handleReplayAll = useCallback(() => {
    setIsCompleted(false);
    handleSeekToIndex(0);
    playerRef.current?.seekTo(0);
    playerRef.current?.play();
  }, [handleSeekToIndex]);

  const handlePracticeAll = useCallback(() => {
    onStartPractice?.();
  }, [onStartPractice]);

  const handleRetryPlayback = useCallback(() => {
    persistProgress();
    setPlayerError(null);
    if (progressRef.current.positionMs > 0) {
      playerRef.current?.seekTo(progressRef.current.positionMs / 1000);
    }
  }, [persistProgress]);

  useEffect(() => {
    if (playerError != null) {
      persistProgress();
    }
  }, [persistProgress, playerError]);

  const showToast = useCallback(
    (msg: string, durationMs: number = TOAST_DURATION_MS) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToastMessage(msg);
      toastTimerRef.current = setTimeout(() => {
        setToastMessage(null);
      }, durationMs);
    },
    [],
  );

  const openToolsPopup = useCallback(() => {
    setIsToolsPopupOpen(true);
  }, []);

  const closeToolsPopup = useCallback(() => {
    setIsToolsPopupOpen(false);
  }, []);

  const abLoopActive =
    abLoopStartIndex != null &&
    abLoopEndIndex != null &&
    abLoopStartIndex <= abLoopEndIndex;

  // SETE-346 (Option A): a single sentence-loop concept (`loopCount`,
  // where Infinity = the old overflow "Repeat sentence" behavior). Once the
  // active segment moves past the one being repeated, jump back to its start.
  // SETE-345: transitions are read from `observedIndex` (player-confirmed),
  // never the optimistic `activeIndex` — a stale pre-seek poll re-applying
  // an already-observed index is a state no-op and can never retrigger a
  // replay, and manual hops preset prevActiveIndexRef so their own
  // confirmation step reads as equality, not a completion.
  useEffect(() => {
    const previous = prevActiveIndexRef.current;
    prevActiveIndexRef.current = observedIndex;
    // SETE-345: the replay arrival confirms the pending replay — later
    // forward steps are genuine completions again.
    if (
      replayPendingRef.current != null &&
      observedIndex === replayPendingRef.current
    ) {
      replayPendingRef.current = null;
    }

    if (isOfflineReading) {
      replayPendingRef.current = null;
      return;
    }

    // SETE-345: disarming the sentence loop (or arming A–B, which is
    // mutually exclusive) drops any unconfirmed replay with it.
    if (loopCount <= 1 || abLoopActive) {
      replayPendingRef.current = null;
    }

    if (
      loopCount > 1 &&
      previous >= 0 &&
      observedIndex > previous &&
      !abLoopActive
    ) {
      // SETE-345: tick-then-poll can deliver the same completion twice;
      // the second delivery arrives while the replay is unconfirmed.
      if (replayPendingRef.current === previous) {
        return;
      }
      if (loopLeftRef.current > 1) {
        loopLeftRef.current -= 1;
        prevActiveIndexRef.current = previous;
        replayPendingRef.current = previous;
        // SETE-345: loop replays seek exactly to start_ms (no 300ms
        // compensation) so the replay never lands inside sentence
        // previous-1 and cascades backwards to sentence 0.
        seekToIndex(previous, {exact: true});
        showToast(
          loopCount === Infinity
            ? 'Lặp vô hạn câu hiện tại'
            : `Lặp câu ${previous + 1} · còn ${loopLeftRef.current} lần`,
        );
        return;
      }
      loopLeftRef.current = loopCount;
    }
  }, [
    abLoopActive,
    observedIndex,
    isOfflineReading,
    loopCount,
    seekToIndex,
    showToast,
  ]);

  // SETE-328 (TASK-1): shell controls. Frame taps toggle play/pause
  // natively inside the iframe (no overlay is ever placed above it); these
  // buttons cover every other context — after seek, after ended, mini.
  const togglePlayPause = useCallback(() => {
    if (isOfflineReading) {
      return;
    }
    if (playing) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  }, [isOfflineReading, playing]);

  const replayActiveSentence = useCallback(() => {
    if (isOfflineReading) {
      return;
    }
    handleSeekToIndex(activeIndex >= 0 ? activeIndex : 0);
  }, [activeIndex, handleSeekToIndex, isOfflineReading]);

  const seekToSeconds = useCallback(
    (seconds: number) => {
      if (isOfflineReading) {
        return;
      }
      playerRef.current?.seekTo(seconds);
    },
    [isOfflineReading],
  );

  const getCurrentTimeS = useCallback(async () => {
    const seconds = await playerRef.current?.getCurrentTime();
    return seconds ?? 0;
  }, []);

  const handlePlayerBlockLayout = useCallback((event: LayoutChangeEvent) => {
    setPlayerBlockHeight(event.nativeEvent.layout.height);
  }, []);

  const scrollBackToPlayer = useCallback(() => {
    setIsCardScrolledDown(false);
    setMiniVisible(false);
    listRef.current?.scrollToOffset({animated: true, offset: 0});
  }, []);

  // SETE-328 / SETE-332 / SETE-346: the Tools button highlights while a
  // loop is armed or the rate differs from 1×.
  const toolsArmed = toolsBadgeActive(loopCount, playbackRate, abLoopActive);

  useEffect(() => {
    if (!abLoopActive || isOfflineReading) {
      return undefined;
    }
    const startIndex = abLoopStartIndex;
    const endIndex = abLoopEndIndex;
    const startMs = lesson.segments[startIndex]?.start_ms;
    const endMs = lesson.segments[endIndex]?.end_ms;
    if (startMs == null || endMs == null) {
      return undefined;
    }

    let cancelled = false;
    const intervalId = setInterval(() => {
      (async () => {
        const timeMs = await getCurrentTimeMs();
        const wrapTo = abWrap(timeMs, startMs, endMs, 80);
        if (cancelled || wrapTo == null) {
          return;
        }
        // SETE-345: A–B wraps seek exactly to the A start so the card
        // never flickers onto sentence A-1 for a tick.
        seekToIndex(startIndex, {exact: true});
        showToast('↻ Lặp lại đoạn A–B');
      })();
    }, TRANSCRIPT_SYNC_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [
    abLoopActive,
    abLoopEndIndex,
    abLoopStartIndex,
    getCurrentTimeMs,
    isOfflineReading,
    lesson.segments,
    seekToIndex,
    showToast,
  ]);

  // Persist progress as the active sentence advances, and flush the latest
  // known position on unmount (exit mid-video).
  useEffect(() => {
    if (!progressEnabled || activeIndex < 0) {
      return;
    }
    progressRef.current.segmentIndex = activeIndex;
    (async () => {
      const timeMs = await getCurrentTimeMs();
      progressRef.current.positionMs = Math.max(0, Math.floor(timeMs));
      persistProgress();
    })();
  }, [activeIndex, getCurrentTimeMs, persistProgress, progressEnabled]);

  useEffect(() => {
    return () => {
      persistProgress();
    };
  }, [persistProgress]);

  // SETE-325 (C-4): popup taps seek the video but never close the popup,
  // and never touch repeat mode — the popup is for hopping between
  // sentences, not for arming loops.
  const handlePopupSeek = useCallback(
    (segment: YouTubeSegment) => {
      if (isOfflineReading) {
        return;
      }
      handleSeekToIndex(segment.index);
    },
    [handleSeekToIndex, isOfflineReading],
  );

  const toggleVietnamese = useCallback(() => {
    setShowVietnamese(current => !current);
  }, []);

  const toggleIpa = useCallback(() => {
    setShowIpa(current => !current);
  }, []);

  // SETE-346 (Option A): sentence loop and A–B range are mutually
  // exclusive — arming one clears the other, never silently overwriting.
  const setAbLoopPointA = useCallback(() => {
    const index = activeIndex >= 0 ? activeIndex : 0;
    setAbLoopStartIndex(index);
    setAbLoopEndIndex(current =>
      current != null && current < index ? null : current,
    );
    setLoopCount(1);
    loopLeftRef.current = 1;
    showToast(
      t('youtube.ab_loop_set_a', {
        defaultValue: `Đã đặt điểm A · câu ${index + 1}`,
        index: index + 1,
      }),
    );
  }, [activeIndex, showToast, t]);

  const setAbLoopPointB = useCallback(() => {
    const index = activeIndex >= 0 ? activeIndex : 0;
    // Preserve the existing "B before A collapses A onto B" contract while
    // computing the toast range synchronously from current state.
    const startIndex = abLoopStartIndex ?? index;
    const resolvedStart = index < startIndex ? index : startIndex;
    setAbLoopStartIndex(resolvedStart);
    setAbLoopEndIndex(index);
    setLoopCount(1);
    loopLeftRef.current = 1;
    showToast(
      t('youtube.ab_loop_set_b', {
        defaultValue: `Đang lặp câu ${resolvedStart + 1}–${index + 1}`,
        from: resolvedStart + 1,
        to: index + 1,
      }),
    );
  }, [abLoopStartIndex, activeIndex, showToast, t]);

  const clearAbLoop = useCallback(() => {
    setAbLoopStartIndex(null);
    setAbLoopEndIndex(null);
    showToast(t('youtube.ab_loop_cleared', {defaultValue: 'Đã xóa lặp A–B'}));
  }, [showToast, t]);

  const openTranscriptPopup = useCallback(() => {
    setIsTranscriptPopupOpen(true);
  }, []);

  const closeTranscriptPopup = useCallback(() => {
    setIsTranscriptPopupOpen(false);
  }, []);

  const handleSelectLoopCount = useCallback(
    (count: SentenceLoopCount) => {
      setLoopCount(count);
      loopLeftRef.current = count;
      if (count > 1) {
        setAbLoopStartIndex(null);
        setAbLoopEndIndex(null);
      }
      if (count === 1) {
        showToast('Tắt lặp câu');
      } else if (count === Infinity) {
        showToast('Lặp vô hạn câu hiện tại');
      } else {
        showToast(`Lặp ${formatLoopLabel(count)} lần/câu`);
      }
    },
    [showToast],
  );

  const [savedWordIds, setSavedWordIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [savedGrammarIds, setSavedGrammarIds] = useState<Set<string>>(
    () => new Set(),
  );

  const savedSegmentIds = useMemo(() => {
    const ids = new Set<string | number>();
    lesson.segments.forEach(segment => {
      const isSaved = vocabularySaveState.getIsSaved(
        segment.id,
        savedVocabularyIds.has(segment.id),
      );
      if (isSaved) {
        ids.add(segment.index);
        ids.add(segment.id);
      }
    });
    return ids;
  }, [lesson.segments, savedVocabularyIds, vocabularySaveState]);

  const handleToggleWordSave = useCallback(
    async (word: string, entry?: VocabEntry) => {
      const wordKey = word.toLowerCase().trim();
      const wordId = `word-${lesson.video.id}-${wordKey}`;
      const isSaved =
        savedWordIds.has(wordKey) || savedVocabularyIds.has(wordId);
      if (isSaved) {
        setSavedWordIds(prev => {
          const next = new Set(prev);
          next.delete(wordKey);
          return next;
        });
        await onVocabularyUnsave(wordId);
      } else {
        setSavedWordIds(prev => {
          const next = new Set(prev);
          next.add(wordKey);
          return next;
        });
        await onVocabularySave(wordId, {
          lessonId: lesson.video.id,
          vocabulary: {
            id: wordId,
            word: entry?.word ?? word,
            phrase_from_text: entry?.inSentenceNote ?? word,
            meaning_vi: entry?.meaning ?? '',
            ipa: entry?.ipa,
            source_sentence: lesson.segments[activeIndex]?.en ?? word,
          },
        });
      }
    },
    [
      activeIndex,
      lesson.segments,
      lesson.video.id,
      onVocabularySave,
      onVocabularyUnsave,
      savedVocabularyIds,
      savedWordIds,
    ],
  );

  const handleSelectPlaybackRate = useCallback((rate: YouTubePlaybackRate) => {
    setPlaybackRate(rate);
  }, []);

  const handleToggleGrammarSave = useCallback((point: GrammarPoint) => {
    const key = point.name;
    setSavedGrammarIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handlePlaySentenceAudio = useCallback(
    (segment: SentenceCardSegment) => {
      if (isOfflineReading) {
        return;
      }
      handleSeekToIndex(segment.index);
    },
    [handleSeekToIndex, isOfflineReading],
  );

  const handlePracticeSentenceSegment = useCallback(
    (segment: SentenceCardSegment) => {
      const fullSegment = lesson.segments[segment.index] ?? {
        id: `${lesson.video.id}-${segment.index}`,
        index: segment.index,
        start_ms: 0,
        end_ms: 0,
        en: segment.en,
        vi: segment.vi,
      };
      onPracticeSentence?.(fullSegment);
    },
    [lesson.segments, lesson.video.id, onPracticeSentence],
  );

  const handleCardScrollOffsetChange = useCallback(
    (_segmentIndex: number, offset: number) => {
      setIsCardScrolledDown(offset >= 40);
      setMiniVisible(previous => {
        const next = shouldShowMiniPlayer({
          scrolledPastPx: offset,
          playerHeightPx: playerBlockHeight,
          windowHeightPt,
        });
        return previous === next ? previous : next;
      });
    },
    [playerBlockHeight, windowHeightPt],
  );

  const handleScrollToActiveSentence = useCallback(() => {
    setIsCardScrolledDown(false);
    setMiniVisible(false);
    if (activeIndex >= 0) {
      listRef.current?.scrollToIndex({
        animated: true,
        index: activeIndex,
      });
    }
  }, [activeIndex]);

  // SETE-325 (C-2): tapping a word speaks it. The service defaults already
  // match the spec (locale en-US, rate 0.5). Failures surface the service's
  // own message (VOICE_UNAVAILABLE included) via an alert.
  const handlePressWord = useCallback(
    (word: string) => {
      async function speakWord(): Promise<void> {
        const result = await speak(word);
        if (!result.ok) {
          Alert.alert(
            t('youtube.tts_error_title', {
              defaultValue: 'Không phát được âm thanh',
            }),
            result.message,
          );
        }
      }
      fireAndForget(speakWord());
    },
    [t],
  );

  const handleToggleSave = useCallback(
    async (segment: YouTubeSegment | SentenceCardSegment) => {
      const fullSegment =
        lesson.segments[segment.index] ?? (segment as YouTubeSegment);
      const targetId =
        'id' in fullSegment && fullSegment.id
          ? fullSegment.id
          : `${lesson.video.id}-${segment.index}`;
      const dbValue = savedVocabularyIds.has(targetId);
      const isSaved = vocabularySaveState.getIsSaved(targetId, dbValue);
      if (isSaved) {
        await onVocabularyUnsave(targetId);
      } else {
        await onVocabularySave(targetId, {
          lessonId: lesson.video.id,
          vocabulary: {
            id: targetId,
            word: segment.en,
            phrase_from_text: segment.en,
            meaning_vi: segment.vi || '',
            ipa: ('ipa' in fullSegment ? fullSegment.ipa : '') || undefined,
            source_sentence: segment.en,
          },
        });
      }
    },
    [
      lesson.segments,
      lesson.video.id,
      onVocabularySave,
      onVocabularyUnsave,
      savedVocabularyIds,
      vocabularySaveState,
    ],
  );

  // SETE-328 (TASK-1): the player block lives in the list header so it
  // scrolls with the transcript — the mini player takes over once it
  // scrolls strictly past 50% (immediately on compact screens).
  const playerHeader = useMemo(
    () => (
      <View onLayout={handlePlayerBlockLayout} testID="youtube-player-block">
        <View style={styles.playerWrap}>
          <YouTubePlayer
            onAdPlayingChange={setIsAdPlaying}
            onEnded={handlePlayerEnded}
            onError={setPlayerError}
            onPlayingChange={handlePlayingChange}
            onReady={handlePlayerReady}
            playbackRate={playbackRate}
            ref={playerRef}
            videoId={lesson.video.id}
          />
        </View>
        <CompactControlBar
          abLoopActive={abLoopActive}
          abLoopEndIndex={abLoopEndIndex}
          abLoopStartIndex={abLoopStartIndex}
          activeIndex={activeIndex}
          disabled={isOfflineReading || isAdPlaying}
          durationS={durationS}
          getCurrentTimeS={getCurrentTimeS}
          onOpenTools={openToolsPopup}
          onReplay={replayActiveSentence}
          onSeekToIndex={handleSeekToIndex}
          onSeekToSeconds={seekToSeconds}
          onTogglePlay={togglePlayPause}
          playing={playing}
          segments={lesson.segments}
          toolsArmed={toolsArmed}
        />
      </View>
    ),
    [
      abLoopActive,
      abLoopEndIndex,
      abLoopStartIndex,
      activeIndex,
      durationS,
      getCurrentTimeS,
      handlePlayerBlockLayout,
      handlePlayerEnded,
      handlePlayerReady,
      handlePlayingChange,
      handleSeekToIndex,
      isAdPlaying,
      isOfflineReading,
      lesson.segments,
      lesson.video.id,
      openToolsPopup,
      playbackRate,
      playing,
      replayActiveSentence,
      seekToSeconds,
      styles,
      togglePlayPause,
      toolsArmed,
    ],
  );

  const headerActions = (
    <View style={styles.headerActions}>
      <IconButton
        accessibilityHint={t('youtube.display_vietnamese_hint')}
        accessibilityLabel={
          showVietnameseEffective
            ? t('youtube.translation_hide_a11y', {defaultValue: 'Ẩn dịch'})
            : t('youtube.translation_show_a11y', {defaultValue: 'Hiện dịch'})
        }
        disabled={!hasVietnamese}
        icon="translate"
        onPress={toggleVietnamese}
        testID="youtube-toggle-vietnamese"
        tone={showVietnameseEffective ? 'accent' : 'surface'}
      />
      <IconButton
        accessibilityHint={t('youtube.display_ipa_hint')}
        accessibilityLabel={
          showIpaEffective
            ? t('youtube.ipa_hide_a11y', {defaultValue: 'Ẩn IPA'})
            : t('youtube.ipa_show_a11y', {defaultValue: 'Hiện IPA'})
        }
        disabled={!hasIpa}
        icon="record_voice_over"
        onPress={toggleIpa}
        testID="youtube-toggle-ipa"
        tone={showIpaEffective ? 'accent' : 'surface'}
      />
      <IconButton
        accessibilityHint={t('youtube.practice_hint', {
          defaultValue: 'Luyện tập câu',
        })}
        accessibilityLabel={t('youtube.practice_title', {
          defaultValue: 'Luyện tập',
        })}
        disabled={!onStartPractice}
        icon="school"
        onPress={() => onStartPractice?.()}
        testID="youtube-start-practice"
        tone="surface"
      />
    </View>
  );

  return (
    <AppScreen>
      <ScreenHeader
        onBack={onBack}
        rightAction={headerActions}
        title={lesson.video.title}
        titleNumberOfLines={1}
      />
      <YouTubeToolsPopup
        abLoopActive={abLoopActive}
        abLoopEndIndex={abLoopEndIndex}
        abLoopStartIndex={abLoopStartIndex}
        activeIndex={activeIndex}
        disabled={isOfflineReading || isAdPlaying}
        loopCount={loopCount}
        onClearAbLoop={clearAbLoop}
        onClose={closeToolsPopup}
        onOpenTranscript={openTranscriptPopup}
        onReplay={replayActiveSentence}
        onSelectLoopCount={handleSelectLoopCount}
        onSelectPlaybackRate={handleSelectPlaybackRate}
        onSetAbLoopPointA={setAbLoopPointA}
        onSetAbLoopPointB={setAbLoopPointB}
        playbackRate={playbackRate}
        segments={lesson.segments}
        topOffset={playerBlockHeight > 0 ? playerBlockHeight : 220}
        visible={isToolsPopupOpen}
      />
      <YouTubeTranscriptPopup
        activeIndex={activeIndex}
        disabled={isOfflineReading || isAdPlaying}
        onClose={closeTranscriptPopup}
        onPracticeSentence={onPracticeSentence}
        onPressWord={handlePressWord}
        onSeekSegment={handlePopupSeek}
        segments={lesson.segments}
        showIpa={showIpaEffective}
        showVietnamese={showVietnameseEffective}
        visible={isTranscriptPopupOpen}
      />
      {saveWarning ? (
        <View
          style={styles.saveWarningBanner}
          testID="youtube-lesson-save-warning"
        >
          <AppText accessibilityRole="alert" variant="label">
            {t('youtube.save_failed_title')}
          </AppText>
          <AppText color="secondary">{t('youtube.save_failed_body')}</AppText>
        </View>
      ) : null}
      {!saveWarning && lesson.warnings.length > 0 ? (
        <View style={styles.saveWarningBanner} testID="youtube-lesson-warnings">
          <AppText variant="label">
            {t('youtube.lesson_warnings_title')}
          </AppText>
          {lesson.warnings.map(warning => (
            <AppText color="secondary" key={warning}>
              {warning}
            </AppText>
          ))}
        </View>
      ) : null}
      {isAdPlaying ? (
        <View style={styles.adBanner} testID="youtube-ad-banner">
          <AppText color="muted" variant="caption">
            {t('youtube.ad_playing_notice', {
              defaultValue: 'Đang phát quảng cáo · Điều khiển tạm khóa',
            })}
          </AppText>
        </View>
      ) : null}
      {isOfflineReading ? (
        <View style={styles.offlineBanner} testID="youtube-offline-banner">
          <View style={styles.bannerTextWrap}>
            <AppText accessibilityRole="alert" variant="label">
              {t('youtube.offline_banner_title')}
            </AppText>
            <AppText color="secondary">
              {t('youtube.offline_banner_body')}
            </AppText>
          </View>
          <View style={styles.bannerActions}>
            <AppButton
              accessibilityHint={t('youtube.retry_hint', {
                defaultValue: 'Thử kết nối lại video',
              })}
              onPress={handleRetryPlayback}
              testID="youtube-offline-retry"
              title={t('youtube.retry_button', {defaultValue: 'Thử lại'})}
              variant="secondary"
            />
          </View>
        </View>
      ) : null}
      {abLoopActive ? (
        <View style={styles.playerControls}>
          <AppText
            color="secondary"
            testID="youtube-ab-loop-status"
            variant="caption"
          >
            {t('youtube.ab_loop_active', {
              from: abLoopStartIndex! + 1,
              to: abLoopEndIndex! + 1,
            })}
          </AppText>
        </View>
      ) : null}
      {playerError ? (
        <View style={styles.errorBanner} testID="youtube-player-error-banner">
          <AppText color="danger" testID="youtube-player-error">
            {getPlayerErrorMessage(playerError, t)}
          </AppText>
          <View style={styles.bannerActions}>
            <AppButton
              accessibilityHint={t('youtube.retry_hint', {
                defaultValue: 'Thử kết nối lại video',
              })}
              onPress={handleRetryPlayback}
              testID="youtube-error-retry"
              title={t('youtube.retry_button', {defaultValue: 'Thử lại'})}
              variant="secondary"
            />
            {onBack ? (
              <AppButton
                accessibilityHint={t('youtube.back_to_list_hint', {
                  defaultValue: 'Quay lại danh sách bài học',
                })}
                onPress={onBack}
                testID="youtube-error-back-to-list"
                title={t('youtube.back_to_list_button', {
                  defaultValue: 'Quay lại danh sách',
                })}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      ) : null}
      {isCompleted ? (
        <View
          style={styles.completedBanner}
          testID="youtube-lesson-completed-actions"
        >
          <AppText style={styles.completedTitle} variant="label">
            {t('youtube.completed_title', {
              defaultValue: '🎉 Đã học xong video!',
            })}
          </AppText>
          <View style={styles.completedButtonsRow}>
            <AppButton
              accessibilityHint={t('youtube.completed_replay_hint', {
                defaultValue: 'Xem lại video từ đầu',
              })}
              iconLeft="refresh"
              onPress={handleReplayAll}
              testID="youtube-completed-replay"
              title={t('youtube.completed_replay_title', {
                defaultValue: 'Xem lại',
              })}
              variant="secondary"
            />
            <AppButton
              accessibilityHint={t('youtube.completed_practice_hint', {
                defaultValue: 'Luyện nói toàn bộ câu trong bài',
              })}
              disabled={!onStartPractice}
              iconLeft="school"
              onPress={handlePracticeAll}
              testID="youtube-completed-practice"
              title={t('youtube.completed_practice_title', {
                defaultValue: 'Luyện nói cả bài',
              })}
              variant="primary"
            />
            {onBack ? (
              <AppButton
                accessibilityHint={t('youtube.completed_next_hint', {
                  defaultValue: 'Quay về danh sách bài học',
                })}
                iconRight="chevron_right"
                onPress={onBack}
                testID="youtube-completed-next-lesson"
                title={t('youtube.completed_next_title', {
                  defaultValue: 'Bài kế',
                })}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      ) : null}
      {playerHeader}
      <SentenceCarousel
        activeIndex={activeIndex}
        enrichmentMap={internalEnrichmentMap}
        level={level}
        onCardScrollOffsetChange={handleCardScrollOffsetChange}
        onPlaySentenceAudio={handlePlaySentenceAudio}
        onPracticeSentence={
          onPracticeSentence ? handlePracticeSentenceSegment : undefined
        }
        onPressBackChip={handleScrollToActiveSentence}
        onPressWord={handlePressWord}
        onSelectIndex={handleSeekToIndex}
        onToggleGrammarSave={handleToggleGrammarSave}
        onToggleSaveSegment={handleToggleSave}
        onToggleWordSave={handleToggleWordSave}
        ref={listRef}
        retryBlock={retryBlock}
        savedGrammarIds={savedGrammarIds}
        savedSegmentIds={savedSegmentIds}
        savedWordIds={savedWordIds}
        segments={lesson.segments}
        showBackChip={isCardScrolledDown && activeIndex >= 0}
        showTranslation={showVietnameseEffective}
        testID={testID}
        toastMessage={toastMessage}
        videoId={lesson.video.id}
      />
      {miniVisible && !isOfflineReading && !isAdPlaying ? (
        <View style={[styles.miniWrap, {bottom: feedClearance}]}>
          <YouTubeMiniPlayer
            activeIndex={activeIndex}
            disabled={isOfflineReading || isAdPlaying}
            durationS={durationS}
            getCurrentTimeS={getCurrentTimeS}
            onOpenTools={openToolsPopup}
            onPress={scrollBackToPlayer}
            onReplay={replayActiveSentence}
            onTogglePlay={togglePlayPause}
            playing={playing}
            totalSegments={lesson.segments.length}
            videoId={lesson.video.id}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

/**
 * SETE-289: registered on both the Create stack (fresh-create flow:
 * `YouTubeProcessing.replace('YouTubeLesson')`) and the RootStack
 * (opening a saved lesson from `YouTubeHistory` above the tabs).
 */
type YouTubeLessonRouteProps =
  | NativeStackScreenProps<CreateStackParamList, 'YouTubeLesson'>
  | NativeStackScreenProps<RootStackParamList, 'YouTubeLesson'>;

export function YouTubeLessonRouteScreen({
  navigation,
  route,
}: YouTubeLessonRouteProps) {
  const nav = navigation as NativeStackScreenProps<
    CreateStackParamList,
    'YouTubeLesson'
  >['navigation'];
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const fallbackStyles = useMemo(() => createStyles(theme), [theme]);
  const params = route.params;
  const lesson =
    'lesson' in params && params.lesson
      ? params.lesson
      : getYouTubeLesson('lessonId' in params ? params.lessonId : '');
  // SETE-283 (HVB-07): the lesson opened even though the local save failed —
  // warn instead of presenting it as saved. Nothing was written, so History
  // gains no phantom row.
  const saveFailed =
    'lesson' in params && params.lesson && params.saveFailed === true;

  // SETE-290 (DEV-4): a freshly created lesson ends at Home — every Back
  // path (header, Android system, gesture) leaves the entry flow instead of
  // returning to the URL input. Saved lessons (lessonId, either stack) keep
  // the plain goBack contract owned by SETE-289.
  const isFreshLesson = 'lesson' in params && params.lesson != null;
  const exitToHome = useCallback(() => {
    const createNav = navigation as NativeStackScreenProps<
      CreateStackParamList,
      'YouTubeLesson'
    >['navigation'];
    createNav.reset({
      index: 0,
      routes: [{name: 'CreateMain'}],
    });
    createNav.getParent<NavigationProp<RootTabParamList>>()?.navigate('Home');
  }, [navigation]);

  useEffect(() => {
    // SETE-330 (mục 6) & SETE-333 (mục 13): disable iOS back-swipe gesture and lock portrait orientation
    navigation.setOptions?.({gestureEnabled: false, orientation: 'portrait'});
    if (!isFreshLesson) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', e => {
      if (e.data.action.type !== 'POP') {
        return;
      }
      e.preventDefault();
      exitToHome();
    });
  }, [navigation, isFreshLesson, exitToHome]);

  const handleBack = useCallback(() => {
    if (isFreshLesson) {
      exitToHome();
      return;
    }
    navigation.goBack();
  }, [navigation, isFreshLesson, exitToHome]);

  const handleStartPractice = useCallback(() => {
    if (!lesson) return;
    const questions = mapTranscriptToPractice(lesson.segments, 10);
    if (questions.length > 0) {
      nav.navigate('Practice', {
        questions,
        title: t('youtube.practice_title', {defaultValue: 'Luyện tập'}),
      });
    }
  }, [lesson, nav, t]);

  // SETE-325 (C-3): "Luyện nói câu này" opens the Speaking Room with the
  // tapped sentence. Fresh lessons sit on the Create stack under the tabs,
  // so the room is reached through the tab parent; lessons opened from
  // History sit on the RootStack above the tabs and go through
  // Tabs > Lessons instead. The tab navigator is identified by its route
  // names (only the RootStack carries a navigator id), so a parent without
  // 'Lessons' among its routes is the RootStack navigator itself.
  // (A parent without getState only happens in test doubles, which stand
  // in for the tab parent.)
  const handlePracticeSentence = useCallback(
    (segment: YouTubeSegment) => {
      const sentenceText = segment.en;
      const tabParent = nav.getParent<NavigationProp<RootTabParamList>>();
      const tabRoutes = tabParent?.getState?.()?.routeNames;
      if (tabParent && (tabRoutes == null || tabRoutes.includes('Lessons'))) {
        tabParent.navigate('Lessons', {
          screen: 'SpeakingRoom',
          params: {sentenceText},
        });
        return;
      }
      const rootNav = tabParent as unknown as
        | NavigationProp<RootStackParamList>
        | undefined;
      rootNav?.navigate('Tabs', {
        screen: 'Lessons',
        params: {screen: 'SpeakingRoom', params: {sentenceText}},
      });
    },
    [nav],
  );

  if (!lesson) {
    return (
      <AppScreen>
        <ScreenHeader
          onBack={() => navigation.goBack()}
          title={t('youtube.lesson_not_found_title')}
        />
        <View style={fallbackStyles.notFoundWrap}>
          <AppText
            color="danger"
            testID="youtube-lesson-not-found"
            variant="h2"
          >
            {t('youtube.lesson_not_found_body')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  return (
    <YouTubeLessonScreen
      lesson={lesson}
      onBack={handleBack}
      onPracticeSentence={handlePracticeSentence}
      onStartPractice={handleStartPractice}
      saveWarning={saveFailed === true}
    />
  );
}
