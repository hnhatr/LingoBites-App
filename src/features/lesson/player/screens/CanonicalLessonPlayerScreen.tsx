import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {Suspense, useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView} from 'react-native';

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

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import type {LessonAnalysis} from '@core/schemas/lesson';

import {CanonicalLessonPlayer} from '../components/CanonicalLessonPlayer';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from '../components/SentenceAnalysisPanel';
import {useCanonicalLesson} from '../logic/useCanonicalLesson';

type Props = NativeStackScreenProps<
  LessonsStackParamList,
  'CanonicalLessonPlayer'
>;

/**
 * One player route for every canonical source. Opens the snapshot (or the
 * offline download), wires per-sentence analysis with offline/retry states,
 * renders the YouTube player with cue highlight/seek, and applies the
 * download status check (`gone` only on HTTP 200 removes the copy).
 */
export function CanonicalLessonPlayerScreen({navigation, route}: Props) {
  const {lessonId} = route.params;
  const {state, open, checkForUpdate, requestAnalysis} =
    useCanonicalLesson(lessonId);
  const [positionMs, setPositionMs] = useState(0);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [lateAnalyses, setLateAnalyses] = useState<
    Record<string, LessonAnalysis>
  >({});
  const [analysisStates, setAnalysisStates] = useState<
    Record<string, SentenceAnalysisPanelState | SentenceAnalysisPanelError>
  >({});
  const floatingClearance = useFloatingTabBarClearance();

  useEffect(() => {
    open();
  }, [open]);

  useFocusEffect(
    useCallback(() => {
      checkForUpdate();
    }, [checkForUpdate]),
  );

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

  return (
    <AppScreen>
      <ScreenHeader title="Lesson" onBack={() => navigation.goBack()} />
      <ScrollView
        testID="canonical-player-screen"
        contentContainerStyle={{paddingBottom: floatingClearance}}
      >
        {state.status === 'idle' || state.status === 'loading' ? (
          <ActivityIndicator testID="canonical-player-loading" />
        ) : state.status === 'archived' ? (
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
        ) : state.status === 'contract-mismatch' ? (
          <AppText testID="canonical-player-update-app">
            Please update the app to open this lesson.
          </AppText>
        ) : state.status === 'error' ? (
          <AppText testID="canonical-player-error">
            {'message' in state.error
              ? state.error.message
              : 'Lesson failed to load.'}
          </AppText>
        ) : (
          <>
            {state.snapshot.youtube ? (
              <Suspense
                fallback={
                  <ActivityIndicator testID="canonical-player-video-loading" />
                }
              >
                <YouTubePlayer
                  videoId={state.snapshot.youtube.video_id}
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
            ) : null}
            <CanonicalLessonPlayer
              snapshot={state.snapshot}
              analyses={state.snapshot.analyses}
              lateAnalyses={lateAnalyses}
              offline={state.offline}
              hasUpdate={state.hasUpdate}
              playbackPositionMs={positionMs}
              videoAvailable={videoAvailable}
              unavailableReason="Video is unavailable. Sentences remain readable below."
              onSeek={ms => setPositionMs(ms)}
              onRequestAnalysis={handleRequestAnalysis}
              onRetryAnalysis={handleRequestAnalysis}
              analysisStates={analysisStates}
            />
            <Pressable
              accessibilityRole="button"
              testID="canonical-player-retry"
              onPress={open}
            >
              <AppText>Retry</AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}
