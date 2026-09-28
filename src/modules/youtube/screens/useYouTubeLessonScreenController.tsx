import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, useWindowDimensions, type LayoutChangeEvent} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {YouTubeSegment} from '../youtubeTranscriptPort';
import {
  clearYouTubeProgress,
  getYouTubeProgress,
  saveYouTubeProgress,
} from '../youtubeQueryPort';
import {
  YouTubePlayer,
  type YouTubePlayerErrorCode,
  type YouTubePlayerRef,
} from '../components/YouTubePlayer';
import {CompactControlBar} from '../components/CompactControlBar';
import {View} from 'react-native';
import {shouldShowMiniPlayer} from '../utils/sentenceSeek';
import type {SentenceCarouselRef} from '../sentence/SentenceCarousel';
import type {SentenceCardSegment} from '../sentence/SentenceCard';
import type {GrammarPoint, VocabEntry} from '@shared/schemas/sentence-contract';
import {useLessonEnrichment} from '../sentence/useLessonEnrichment';
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
import {useFloatingTabBarClearance} from '@components/layout';
import {useBookmarkOptimistic, useFlashcardLibrary} from '@modules/review';
import type {YouTubePlaybackRate} from '../utils/playbackRate';
import type {YouTubeLessonScreenProps} from './youtubeLessonScreenTypes';
import {createYouTubeLessonScreenStyles} from './youtubeLessonScreenStyles';
import {useAppTheme} from '@theme';

/** Runs an async side effect without returning its promise to the caller. */
function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

export type UseYouTubeLessonScreenControllerParams = Pick<
  YouTubeLessonScreenProps,
  | 'lesson'
  | 'saveWarning'
  | 'onStartPractice'
  | 'onPracticeSentence'
  | 'enrichmentMap'
>;

export function useYouTubeLessonScreenController({
  lesson,
  onStartPractice,
  saveWarning = false,
  onPracticeSentence,
  enrichmentMap,
}: UseYouTubeLessonScreenControllerParams) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const feedClearance = useFloatingTabBarClearance();
  const styles = useMemo(() => createYouTubeLessonScreenStyles(theme), [theme]);

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

  return {
    feedClearance,
    styles,
    listRef,
    internalEnrichmentMap,
    abLoopActive,
    abLoopEndIndex,
    abLoopStartIndex,
    activeIndex,
    clearAbLoop,
    closeToolsPopup,
    closeTranscriptPopup,
    handleCardScrollOffsetChange,
    handlePlaySentenceAudio,
    handlePracticeSentenceSegment,
    handlePressWord,
    handlePopupSeek,
    handleReplayAll,
    handlePracticeAll,
    handleRetryPlayback,
    handleScrollToActiveSentence,
    handleSeekToIndex,
    handleSelectLoopCount,
    handleSelectPlaybackRate,
    handleToggleGrammarSave,
    handleToggleSave,
    handleToggleWordSave,
    hasIpa,
    hasVietnamese,
    isAdPlaying,
    isCardScrolledDown,
    isCompleted,
    isOfflineReading,
    isToolsPopupOpen,
    isTranscriptPopupOpen,
    loopCount,
    miniVisible,
    openToolsPopup,
    openTranscriptPopup,
    playbackRate,
    playerBlockHeight,
    playerError,
    playerHeader,
    replayActiveSentence,
    savedGrammarIds,
    savedSegmentIds,
    savedWordIds,
    scrollBackToPlayer,
    showIpaEffective,
    showVietnameseEffective,
    toastMessage,
    toggleIpa,
    togglePlayPause,
    toggleVietnamese,
    durationS,
    getCurrentTimeS,
    playing,
    setAbLoopPointA,
    setAbLoopPointB,
  };
}

export type YouTubeLessonScreenViewModel = ReturnType<
  typeof useYouTubeLessonScreenController
>;
