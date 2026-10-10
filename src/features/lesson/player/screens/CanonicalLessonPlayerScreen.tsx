import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

/**
 * Lazily loaded through the youtube feature's public barrel so importing this
 * screen never pulls the native video module into suites that never render
 * video (`react-native-youtube-iframe` is untransformed ESM under jest).
 */
const YouTubePlayer = React.lazy(() =>
  import('../components/YouTubePlayer').then(module => ({
    default: module.YouTubePlayer,
  })),
);

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {useAppNavigation} from '@core/navigation';
import {useFeatureEnabled} from '@core/release';
import type {LessonAnalysis} from '@core/schemas/lesson';

import {isFlowLesson} from '../../flow/logic/practiceCompletion';
import {useFlowEntry} from '../../flow/logic/useFlowEntry';
import {
  CanonicalLessonHub,
  type LessonHubSection,
  lessonSectionTitleKey,
} from '../components/CanonicalLessonHub';
import {CanonicalLessonPlayer} from '../components/CanonicalLessonPlayer';
import {ComposeSheet} from '../components/ComposeSheet';
import {LessonDisplayToggles} from '../components/LessonDisplayToggles';
import {LessonGrammarSection} from '../components/LessonGrammarSection';
import {LessonListeningSection} from '../components/LessonListeningSection';
import {LessonPatternSection} from '../components/LessonPatternSection';
import {LessonPronunciationSection} from '../components/LessonPronunciationSection';
import {LessonVocabularySection} from '../components/LessonVocabularySection';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from '../components/SentenceAnalysisPanel';
import type {YouTubePlayerRef} from '../components/YouTubePlayer';
import {canComposeFrom} from '../logic/composePick';
import {
  markComposedLessonSeen,
  requestComposeSheet,
  useComposeTracker,
} from '../logic/composeTracker';
import {
  collectLessonGrammar,
  collectLessonListening,
  collectLessonPatterns,
  collectLessonPronunciation,
  collectLessonVocabulary,
  mergeAnalyses,
} from '../logic/lessonHubContent';
import {isLessonNotDownloaded} from '../logic/lessonNotDownloaded';
import {useCanonicalLesson} from '../logic/useCanonicalLesson';
import {useComposeAvailable} from '../logic/useComposePick';
import {useLessonCompletion} from '../logic/useLessonCompletion';
import {useLessonSavedItems} from '../logic/useLessonSavedItems';
import type {LessonFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<
  LessonFlowParamList,
  'CanonicalLessonPlayer'
>;

type PlayerView = 'hub' | LessonHubSection;

function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

/**
 * One player route for every canonical source. Opens the snapshot (or the
 * offline download), wires per-sentence analysis with offline/retry states,
 * renders the YouTube player with cue highlight/seek, and applies the
 * download status check (`gone` only on HTTP 200 removes the copy).
 *
 * Text/OCR/admin lessons open on the Lesson Hub overview and switch to the
 * sentence, vocabulary and grammar sections in place (same route); back
 * returns to the overview first. YouTube lessons keep the video layout.
 */
export function CanonicalLessonPlayerScreen({navigation, route}: Props) {
  const {lessonId} = route.params;
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {state, open, checkForUpdate, requestAnalysis} =
    useCanonicalLesson(lessonId);
  const {
    state: completionState,
    complete: completeLesson,
    markStarted,
  } = useLessonCompletion(lessonId);
  const savedItems = useLessonSavedItems(lessonId);
  const appNavigation = useAppNavigation();
  const practiceEnabled = useFeatureEnabled('shortPractice');
  const reloadSavedItems = savedItems.reload;
  const [positionMs, setPositionMs] = useState(0);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const offline = useIsOffline();
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMountKey, setVideoMountKey] = useState(0);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showIpa, setShowIpa] = useState(true);
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);
  const seekHoldMsRef = useRef<number | null>(null);
  const [view, setView] = useState<PlayerView>('hub');
  const [lateAnalyses, setLateAnalyses] = useState<
    Record<string, LessonAnalysis>
  >({});
  const [analysisStates, setAnalysisStates] = useState<
    Record<string, SentenceAnalysisPanelState | SentenceAnalysisPanelError>
  >({});
  const floatingClearance = useFloatingTabBarClearance();
  const composeAvailable = useComposeAvailable();
  const [composeOpen, setComposeOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    open();
  }, [open]);

  const lessonReady = state.status === 'ready';
  useEffect(() => {
    if (lessonReady) {
      markStarted();
      // S4.3: a composed lesson the learner opens needs no "ready" banner.
      markComposedLessonSeen(lessonId);
    }
  }, [lessonId, lessonReady, markStarted]);

  useFocusEffect(
    useCallback(() => {
      checkForUpdate();
    }, [checkForUpdate]),
  );

  // Saved state can change elsewhere (Library, Review) while this is open.
  useFocusEffect(reloadSavedItems);

  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const flowEntry = useFlowEntry(lessonId, snapshot);
  // A six-step lesson opens on its hub even when it came from a video (S4.3:
  // a learner's lesson composed from YouTube sentences keeps source_type).
  const flowLesson = snapshot !== null && isFlowLesson(snapshot);
  const isYouTubeStudy = snapshot?.source_type === 'youtube' && !flowLesson;
  const isYouTubeLegacy =
    snapshot !== null &&
    !flowLesson &&
    Boolean(snapshot.youtube) &&
    snapshot.source_type !== 'youtube';
  const canCompose =
    composeAvailable && snapshot !== null && canComposeFrom(snapshot);
  const openCompose = canCompose ? () => setComposeOpen(true) : undefined;

  // An "Đang tạo bài" card opened this lesson to show its compose progress.
  const sheetRequested = useComposeTracker(
    store => store.sheetLessonId === lessonId,
  );
  const composeSheetShown = snapshot !== null && canComposeFrom(snapshot);
  useEffect(() => {
    if (sheetRequested && composeSheetShown) {
      setComposeOpen(true);
      requestComposeSheet(null);
    }
  }, [composeSheetShown, sheetRequested]);
  const isYouTube = isYouTubeStudy || isYouTubeLegacy;
  const inSection = snapshot !== null && !isYouTube && view !== 'hub';

  const openView = useCallback((next: PlayerView) => {
    setView(next);
    scrollRef.current?.scrollTo({y: 0, animated: false});
  }, []);

  // Hardware back / swipe from a section returns to the overview first.
  useEffect(() => {
    if (!inSection) return undefined;
    return navigation.addListener?.('beforeRemove', event => {
      event.preventDefault();
      openView('hub');
    });
  }, [inSection, navigation, openView]);

  const handleSpeak = useCallback((text: string) => {
    fireAndForget(speak(text));
  }, []);

  const handleRequestAnalysis = useCallback(
    async (sentenceId: string) => {
      setAnalysisStates(previous => ({
        ...previous,
        [sentenceId]: {status: 'loading'},
      }));
      const result = await requestAnalysis(sentenceId);
      if (result.ok) {
        setLateAnalyses(previous => ({
          ...previous,
          [sentenceId]: result.value,
        }));
        setAnalysisStates(previous => {
          const next = {...previous};
          delete next[sentenceId];
          return next;
        });
        return;
      }
      if (result.kind === 'analysis-busy') {
        setAnalysisStates(previous => ({
          ...previous,
          [sentenceId]: {status: 'busy'},
        }));
        return;
      }
      if (result.kind === 'network-error') {
        setAnalysisStates(previous => ({
          ...previous,
          [sentenceId]: {status: 'offline-missing'},
        }));
        return;
      }
      setAnalysisStates(previous => ({
        ...previous,
        [sentenceId]: {
          status: 'failed',
          retryable: result.retryable,
          message: result.message,
        },
      }));
    },
    [requestAnalysis],
  );

  const analyses = useMemo(
    () => mergeAnalyses(snapshot?.analyses ?? {}, lateAnalyses),
    [snapshot, lateAnalyses],
  );
  const vocabulary = useMemo(
    () => (snapshot ? collectLessonVocabulary(snapshot, analyses) : []),
    [snapshot, analyses],
  );
  const grammar = useMemo(
    () => (snapshot ? collectLessonGrammar(snapshot, analyses) : []),
    [snapshot, analyses],
  );
  const patterns = useMemo(
    () => (snapshot ? collectLessonPatterns(snapshot) : []),
    [snapshot],
  );
  const pronunciation = useMemo(
    () => (snapshot ? collectLessonPronunciation(snapshot) : []),
    [snapshot],
  );
  const listening = useMemo(
    () => (snapshot ? collectLessonListening(snapshot) : []),
    [snapshot],
  );

  const showHub = snapshot !== null && !isYouTube && view === 'hub';
  // Lesson names can be long: the header keeps a short generic title and
  // the full lesson name is rendered in the page body.
  const title = inSection
    ? t(
        lessonSectionTitleKey(
          view as LessonHubSection,
          (snapshot?.lesson_items ?? []).length > 0,
        ),
      )
    : t('lessonPlayer.player_title');

  const handleSeek = useCallback((ms: number) => {
    seekHoldMsRef.current = ms;
    setPositionMs(ms);
    youtubePlayerRef.current?.seekTo(ms / 1000);
  }, []);

  const handleTimeUpdate = useCallback((seconds: number) => {
    const ms = Math.floor(seconds * 1000);
    const hold = seekHoldMsRef.current;
    if (hold !== null) {
      if (ms + 500 < hold) {
        return;
      }
      seekHoldMsRef.current = null;
    }
    setPositionMs(ms);
  }, []);

  const handlePauseVideo = useCallback(() => {
    youtubePlayerRef.current?.pause();
    setVideoPlaying(false);
  }, []);

  const handleRetryVideo = useCallback(() => {
    setVideoAvailable(true);
    setVideoPlaying(false);
    setVideoMountKey(key => key + 1);
  }, []);

  const renderPlayer = (options?: {
    videoSlot?: React.ReactNode;
    onRetryVideo?: () => void;
  }) =>
    snapshot ? (
      <CanonicalLessonPlayer
        snapshot={snapshot}
        analyses={snapshot.analyses}
        lateAnalyses={lateAnalyses}
        offline={state.status === 'ready' ? state.offline : false}
        hasUpdate={state.status === 'ready' ? state.hasUpdate : false}
        playbackPositionMs={positionMs}
        videoAvailable={videoAvailable}
        videoPlaying={videoPlaying}
        showTranslation={showTranslation}
        showIpa={showIpa}
        unavailableReason={
          offline
            ? t('lessonPlayer.video_offline')
            : t('lessonPlayer.video_unavailable')
        }
        videoSlot={options?.videoSlot}
        onRetryVideo={options?.onRetryVideo}
        onSeek={handleSeek}
        onPauseVideo={handlePauseVideo}
        onRequestAnalysis={handleRequestAnalysis}
        onRetryAnalysis={handleRequestAnalysis}
        analysisStates={analysisStates}
        onSpeakText={handleSpeak}
        vocabularySave={savedItems.vocabulary}
      />
    ) : null;

  const renderBody = () => {
    if (state.status === 'idle' || state.status === 'loading') {
      return (
        <View style={themedStyles.centered}>
          <ActivityIndicator
            color={theme.colors.primary}
            size="large"
            testID="canonical-player-loading"
          />
          <AppText color="secondary">{t('lessonPlayer.loading')}</AppText>
        </View>
      );
    }
    if (state.status === 'archived') {
      return (
        <CanonicalLessonPlayer
          snapshot={{
            id: lessonId,
            slug: '',
            title: '',
            description: '',
            origin: 'admin',
            source_type: 'admin_text',
            content_revision: 1,
            unit: null,
            youtube: null,
            sentences: [],
            blocks: [],
            analyses: {},
          }}
          analyses={{}}
          archived
        />
      );
    }
    if (state.status === 'contract-mismatch') {
      return (
        <AppText testID="canonical-player-update-app" color="secondary">
          {t('lessonPlayer.update_app')}
        </AppText>
      );
    }
    if (state.status === 'error') {
      return (
        <View testID="canonical-player-error" style={themedStyles.errorBox}>
          <AppText color="danger">
            {isLessonNotDownloaded(state)
              ? t('lessonPlayer.not_downloaded')
              : 'message' in state.error
              ? state.error.message
              : t('lessonPlayer.load_failed')}
          </AppText>
          <AppButton
            accessibilityHint={t('lessonPlayer.retry_load_hint')}
            onPress={open}
            testID="canonical-player-retry"
            title={t('common.retry')}
            variant="secondary"
          />
        </View>
      );
    }
    if (!snapshot) return null;
    if (isYouTubeStudy) {
      return renderPlayer({
        onRetryVideo: handleRetryVideo,
        videoSlot: (
          <Suspense
            fallback={
              <ActivityIndicator testID="canonical-player-video-loading" />
            }
          >
            <YouTubePlayer
              key={videoMountKey}
              ref={youtubePlayerRef}
              videoId={snapshot.youtube!.video_id}
              onPlayingChange={setVideoPlaying}
              onTimeUpdate={handleTimeUpdate}
              onError={() => {
                setVideoAvailable(false);
                setVideoPlaying(false);
              }}
            />
          </Suspense>
        ),
      });
    }
    if (isYouTubeLegacy) {
      return (
        <>
          <Suspense
            fallback={
              <ActivityIndicator testID="canonical-player-video-loading" />
            }
          >
            <YouTubePlayer
              videoId={snapshot.youtube!.video_id}
              onPlayingChange={setVideoPlaying}
              onTimeUpdate={seconds =>
                setPositionMs(Math.floor(seconds * 1000))
              }
              onError={code => {
                if (
                  code === 'YOUTUBE_VIDEO_NOT_FOUND' ||
                  code === 'YOUTUBE_NOT_EMBEDDABLE'
                ) {
                  setVideoAvailable(false);
                  setVideoPlaying(false);
                }
              }}
            />
          </Suspense>
          {renderPlayer()}
        </>
      );
    }
    switch (view) {
      case 'hub':
        return (
          <CanonicalLessonHub
            snapshot={snapshot}
            analyses={analyses}
            offline={state.status === 'ready' ? state.offline : false}
            hasUpdate={state.status === 'ready' ? state.hasUpdate : false}
            onOpenSection={openView}
            onOpenLesson={appNavigation.openLesson}
            onOpenPractice={
              practiceEnabled
                ? () => appNavigation.openPractice(lessonId)
                : undefined
            }
            onOpenCompose={openCompose}
          />
        );
      case 'sentences':
        return renderPlayer();
      case 'vocabulary':
        return (
          <LessonVocabularySection
            entries={vocabulary}
            onSpeakText={handleSpeak}
            saveControl={savedItems.vocabulary}
          />
        );
      case 'grammar':
        return (
          <LessonGrammarSection
            entries={grammar}
            saveControl={savedItems.grammar}
          />
        );
      case 'patterns':
        return (
          <LessonPatternSection
            entries={patterns}
            onSpeakText={handleSpeak}
            saveControl={savedItems.patterns}
          />
        );
      case 'pronunciation':
        return (
          <LessonPronunciationSection
            entries={pronunciation}
            onSpeakText={handleSpeak}
          />
        );
      case 'listening':
        return (
          <LessonListeningSection
            entries={listening}
            onSpeakText={handleSpeak}
          />
        );
    }
  };

  const studyReady = isYouTubeStudy && state.status === 'ready';
  // Curriculum lessons start the six-step player (PR 10, decision G1).
  const startLabel = !flowEntry.available
    ? t('lessonPlayer.start_learning')
    : flowEntry.resumeAt !== null
    ? t('lessonFlow.continue_at', {step: flowEntry.resumeAt})
    : t('lessonFlow.start');

  return (
    <AppScreen>
      <ScreenHeader
        title={title}
        onBack={() => (inSection ? openView('hub') : navigation.goBack())}
        rightAction={
          studyReady ? (
            <>
              {openCompose ? (
                <HeaderIconButton
                  accessibilityHint={t('compose.entry_subtitle')}
                  accessibilityLabel={t('compose.entry_a11y')}
                  icon="auto_awesome"
                  onPress={openCompose}
                  testID="youtube-open-compose"
                />
              ) : null}
              <LessonDisplayToggles
                onToggleIpa={() => setShowIpa(value => !value)}
                onToggleTranslation={() => setShowTranslation(value => !value)}
                showIpa={showIpa}
                showTranslation={showTranslation}
              />
            </>
          ) : showHub &&
            completionState !== 'finished' &&
            !flowEntry.available ? (
            <HeaderIconButton
              accessibilityHint={t('lessonPlayer.complete_lesson_hint')}
              accessibilityLabel={t('lessonPlayer.complete_lesson')}
              icon="check_circle"
              onPress={completeLesson}
              testID="canonical-hub-complete"
            />
          ) : undefined
        }
      />
      {studyReady ? (
        <View style={themedStyles.study} testID="canonical-player-screen">
          {renderBody()}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={themedStyles.scroll}
          testID="canonical-player-screen"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            themedStyles.content,
            showHub ? null : {paddingBottom: floatingClearance},
          ]}
        >
          {renderBody()}
        </ScrollView>
      )}
      {showHub ? (
        <BottomActionBar style={themedStyles.actionBar}>
          {flowEntry.available ? (
            // Curriculum lessons complete through their practice (G6).
            flowEntry.practiceDone ? (
              <AppText
                color="secondary"
                testID="canonical-hub-practice-done"
                variant="label"
              >
                {t('lessonFlow.practice_done')}
              </AppText>
            ) : null
          ) : completionState === 'finished' ? (
            <AppText
              color="secondary"
              testID="canonical-hub-completed"
              variant="label"
            >
              {t('lessonPlayer.completed_label')}
            </AppText>
          ) : null}
          {completionState === 'error' ? (
            <AppText
              color="danger"
              testID="canonical-hub-complete-error"
              variant="body"
            >
              {t('lessonPlayer.complete_error')}
            </AppText>
          ) : null}
          <PrimaryActionButton
            accessibilityLabel={startLabel}
            label={startLabel}
            onPress={() =>
              flowEntry.available
                ? appNavigation.openLessonFlow(lessonId)
                : openView('sentences')
            }
            testID={
              flowEntry.available
                ? 'canonical-hub-start-flow'
                : 'canonical-hub-start'
            }
          />
        </BottomActionBar>
      ) : null}
      {snapshot && (canCompose || (composeOpen && composeSheetShown)) ? (
        <ComposeSheet
          offline={state.status === 'ready' ? state.offline : false}
          onClose={() => setComposeOpen(false)}
          onOpenLesson={appNavigation.openLesson}
          onSpeakText={handleSpeak}
          snapshot={snapshot}
          visible={composeOpen}
        />
      ) : null}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actionBar: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.outlineVariant,
    },
    centered: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
    },
    content: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    scroll: {
      flex: 1,
    },
    study: {
      flex: 1,
    },
    errorBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
  });
}
