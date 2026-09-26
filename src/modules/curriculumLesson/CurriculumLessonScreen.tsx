import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import type {
  HomeStackParamList,
  LessonsStackParamList,
} from '@/app/navigation/types';
import {AppButton} from '@components/AppButton';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {ScreenHeader} from '@components/ScreenHeader';
import {useAppTheme, type AppTheme} from '@theme';
import {
  checkCurriculumLessonExercise,
  fetchCurriculumLesson,
  type CurriculumLessonAnswerInput,
  type CurriculumLessonCheckResult,
} from './curriculumLessonClient';
import type {CurriculumLesson} from './curriculumLessonSchema';
import {CurriculumLessonPlayer} from './CurriculumLessonPlayer';
import {
  startLessonProgress,
  submitExerciseAttempt,
} from '@shared/api/learningClient';

/**
 * Mounted in both the Lessons and Home stacks (LING-41 TASK-006: Home
 * opens the canonical player without leaving the tab). Both routes
 * carry the same `{lessonId}` params; only `goBack` navigation is used.
 */
type Props =
  | NativeStackScreenProps<LessonsStackParamList, 'CurriculumLesson'>
  | NativeStackScreenProps<HomeStackParamList, 'CurriculumLesson'>;

type ScreenState =
  | {status: 'loading'}
  | {status: 'ready'; lesson: CurriculumLesson}
  | {
      status: 'not-found' | 'content-error' | 'network-error' | 'auth-error';
      message: string;
      retryable: boolean;
    };

const COPY: Record<
  Exclude<ScreenState, {status: 'loading'} | {status: 'ready'}>['status'],
  {title: string; message: string}
> = {
  'not-found': {
    title: 'Lesson unavailable',
    message:
      'This lesson is no longer available. It may have been unpublished.',
  },
  'content-error': {
    title: 'Lesson unavailable',
    message: "This lesson's content can't be shown right now.",
  },
  'network-error': {
    title: 'Connection problem',
    message: "Couldn't load this lesson. Check your connection and try again.",
  },
  'auth-error': {
    title: 'Sign-in required',
    message: 'Please sign in again to open this lesson.',
  },
};

/** Runs an async side effect without returning its promise to the caller. */
function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    body: {
      flex: 1,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    centered: {
      alignItems: 'center',
      flex: 1,
      gap: theme.spacing.md,
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    action: {
      flex: 1,
    },
  });
}

/**
 * TASK-008 host screen: loads one published curriculum lesson aggregate
 * and hands the snapshot to `CurriculumLessonPlayer`. Owns remote-load
 * state only (loading / ready / not-found / network / content /
 * auth-error; empty is rendered by the player placeholder); the player
 * owns local step/exercise state. In-flight loads abort on unmount or
 * `lessonId` change and late results are ignored by sequence guard, so a
 * demoted or stale lesson can never overwrite the current snapshot.
 * Exercise checks go straight to the live Server client. Nothing is
 * persisted here or downstream (BR-003).
 */
export function CurriculumLessonScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const styles = createStyles(theme);
  const {lessonId} = route.params;

  const [state, setState] = useState<ScreenState>({status: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({status: 'loading'});
    let settled = false;
    const markSettled = () => {
      settled = true;
    };
    fireAndForget(
      fetchCurriculumLesson(lessonId, {signal: controller.signal}).then(
        result => {
          if (settled || sequenceRef.current !== sequence) {
            return;
          }
          markSettled();
          if (result.ok) {
            setState({status: 'ready', lesson: result.lesson});
            return;
          }
          if (result.cancelled) {
            return;
          }
          if (result.kind === 'not-found') {
            setState({
              status: 'not-found',
              message: result.message,
              retryable: result.retryable,
            });
          } else if (result.kind === 'content-error') {
            setState({
              status: 'content-error',
              message: result.message,
              retryable: result.retryable,
            });
          } else if (result.kind === 'auth-error') {
            setState({
              status: 'auth-error',
              message: result.message,
              retryable: result.retryable,
            });
          } else {
            setState({
              status: 'network-error',
              message: result.message,
              retryable: result.retryable,
            });
          }
        },
      ),
    );
    return () => {
      markSettled();
      controller.abort();
    };
  }, [lessonId, attempt]);

  const startedLessonIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      state.status === 'ready' &&
      startedLessonIdRef.current !== state.lesson.id
    ) {
      startedLessonIdRef.current = state.lesson.id;
      fireAndForget(startLessonProgress(state.lesson.id));
    }
  }, [state]);

  const handleExit = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRetry = useCallback(() => {
    setAttempt(value => value + 1);
  }, []);

  const handleCheckExercise = useCallback(
    async (
      exerciseId: string,
      answer: CurriculumLessonAnswerInput,
    ): Promise<CurriculumLessonCheckResult> => {
      fireAndForget(submitExerciseAttempt(exerciseId, answer));
      return checkCurriculumLessonExercise(exerciseId, answer);
    },
    [],
  );

  if (state.status === 'loading') {
    return (
      <AppScreen>
        <View style={styles.centered} testID="curriculum-lesson-loading">
          <ActivityIndicator
            color={theme.colors.primary}
            size="large"
            testID="curriculum-lesson-spinner"
          />
          <AppText color="secondary">Loading lesson…</AppText>
        </View>
      </AppScreen>
    );
  }

  if (state.status === 'ready') {
    return (
      <AppScreen>
        <ScreenHeader onBack={handleExit} title={state.lesson.title} />
        <View style={styles.body} testID="curriculum-lesson-ready">
          <CurriculumLessonPlayer
            key={state.lesson.id}
            lesson={state.lesson}
            onCheckExercise={handleCheckExercise}
            onExit={handleExit}
            onRetry={handleRetry}
          />
        </View>
      </AppScreen>
    );
  }

  const copy = COPY[state.status];
  return (
    <AppScreen>
      <ScreenHeader onBack={handleExit} title={copy.title} />
      <View
        style={styles.centered}
        testID={`curriculum-lesson-error-${state.status}`}
      >
        <AppText color="secondary" testID="curriculum-lesson-error-message">
          {copy.message}
        </AppText>
        <View style={styles.actions}>
          {state.retryable ? (
            <View style={styles.action}>
              <AppButton
                title="Retry"
                variant="secondary"
                onPress={handleRetry}
                testID="curriculum-lesson-retry"
              />
            </View>
          ) : null}
          <View style={styles.action}>
            <AppButton
              title="Back to lessons"
              variant="secondary"
              onPress={handleExit}
              testID="curriculum-lesson-exit"
            />
          </View>
        </View>
      </View>
    </AppScreen>
  );
}
