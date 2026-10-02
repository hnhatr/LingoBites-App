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
import type {LessonsStackParamList} from '@features/lesson/library';

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
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis} from '@core/schemas/lesson';

import {
  CanonicalLessonHub,
  type LessonHubSection,
} from '../components/CanonicalLessonHub';
import {CanonicalLessonPlayer} from '../components/CanonicalLessonPlayer';
import {LessonGrammarSection} from '../components/LessonGrammarSection';
import {LessonVocabularySection} from '../components/LessonVocabularySection';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from '../components/SentenceAnalysisPanel';
import {
  collectLessonGrammar,
  collectLessonVocabulary,
  mergeAnalyses,
} from '../logic/lessonHubContent';
import {useCanonicalLesson} from '../logic/useCanonicalLesson';

type Props = NativeStackScreenProps<
  LessonsStackParamList,
  'CanonicalLessonPlayer'
>;

type PlayerView = 'hub' | LessonHubSection;

const SECTION_TITLE_KEYS: Record<LessonHubSection, string> = {
  sentences: 'lessonPlayer.explore_sentences_title',
  vocabulary: 'lessonPlayer.explore_vocabulary_title',
  grammar: 'lessonPlayer.explore_grammar_title',
};

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
  const [positionMs, setPositionMs] = useState(0);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [view, setView] = useState<PlayerView>('hub');
  const [lateAnalyses, setLateAnalyses] = useState<
    Record<string, LessonAnalysis>
  >({});
  const [analysisStates, setAnalysisStates] = useState<
    Record<string, SentenceAnalysisPanelState | SentenceAnalysisPanelError>
  >({});
  const floatingClearance = useFloatingTabBarClearance();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    open();
  }, [open]);

  useFocusEffect(
    useCallback(() => {
      checkForUpdate();
    }, [checkForUpdate]),
  );

  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const isYouTube = Boolean(snapshot?.youtube);
  const inSection = snapshot !== null && !isYouTube && view !== 'hub';

  const openView = useCallback((next: PlayerView) => {
    setView(next);
    scrollRef.current?.scrollTo({y: 0, animated: false});
  }, []);

  // Hardware back / swipe from a section returns to the overview first.
  // Other removals (tab re-press popToTop, resets) are left alone.
  useEffect(() => {
    if (!inSection) return undefined;
    return navigation.addListener?.('beforeRemove', event => {
      const type = event.data.action.type;
      if (type !== 'GO_BACK' && type !== 'POP') return;
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

  const showHub = snapshot !== null && !isYouTube && view === 'hub';
  const title = inSection
    ? t(SECTION_TITLE_KEYS[view as LessonHubSection])
    : t('lessonPlayer.player_title');

  const renderPlayer = () =>
    snapshot ? (
      <CanonicalLessonPlayer
        snapshot={snapshot}
        analyses={snapshot.analyses}
        lateAnalyses={lateAnalyses}
        offline={state.status === 'ready' ? state.offline : false}
        hasUpdate={state.status === 'ready' ? state.hasUpdate : false}
        playbackPositionMs={positionMs}
        videoAvailable={videoAvailable}
        unavailableReason={t('lessonPlayer.video_unavailable')}
        onSeek={ms => setPositionMs(ms)}
        onRequestAnalysis={handleRequestAnalysis}
        onRetryAnalysis={handleRequestAnalysis}
        analysisStates={analysisStates}
        onSpeakText={handleSpeak}
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
            {'message' in state.error
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
    if (isYouTube) {
      return (
        <>
          <Suspense
            fallback={
              <ActivityIndicator testID="canonical-player-video-loading" />
            }
          >
            <YouTubePlayer
              videoId={snapshot.youtube!.video_id}
              onTimeUpdate={seconds =>
                setPositionMs(Math.floor(seconds * 1000))
              }
              onError={code => {
                if (
                  code === 'YOUTUBE_VIDEO_NOT_FOUND' ||
                  code === 'YOUTUBE_NOT_EMBEDDABLE'
                ) {
                  setVideoAvailable(false);
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
          />
        );
      case 'sentences':
        return renderPlayer();
      case 'vocabulary':
        return (
          <LessonVocabularySection
            entries={vocabulary}
            onSpeakText={handleSpeak}
          />
        );
      case 'grammar':
        return <LessonGrammarSection entries={grammar} />;
    }
  };

  return (
    <AppScreen>
      <ScreenHeader
        title={title}
        onBack={() => (inSection ? openView('hub') : navigation.goBack())}
      />
      <ScrollView
        ref={scrollRef}
        testID="canonical-player-screen"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          themedStyles.content,
          showHub ? null : {paddingBottom: floatingClearance},
        ]}
      >
        {renderBody()}
      </ScrollView>
      {showHub ? (
        <BottomActionBar
          style={[themedStyles.actionBar, {paddingBottom: floatingClearance}]}
        >
          <PrimaryActionButton
            accessibilityHint={t('lessonPlayer.start_learning_hint')}
            accessibilityLabel={t('lessonPlayer.start_learning')}
            label={t('lessonPlayer.start_learning')}
            onPress={() => openView('sentences')}
            testID="canonical-hub-start"
          />
        </BottomActionBar>
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
    errorBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
  });
}
