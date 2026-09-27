import React, {useCallback, useState} from 'react';
import {Alert, Pressable, ScrollView, View} from 'react-native';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {ErrorCard} from '@components/ErrorCard';
import {HandoffProgressTrack} from '@components/HandoffProgressTrack';
import {IconButton} from '@components/IconButton';
import {ScreenHeader} from '@components/ScreenHeader';
import {useAppTheme} from '@theme';
import {createLessonRuntimeSession} from './ContentLessonRuntime';
import {evaluateCheck} from '../checks/checkEvaluator';
import {playContentAudio} from './contentAudioPlayer';
import {ActiveRecallCard} from './activities/ActiveRecallCard';
import {ContextCard} from './activities/ContextCard';
import {ExitCheckCard} from './activities/ExitCheckCard';
import {FeedbackCard} from './activities/FeedbackCard';
import {GuidedPracticeCard} from './activities/GuidedPracticeCard';
import {RolePlayCard} from './activities/RolePlayCard';
import {ShadowingCard} from './activities/ShadowingCard';
import type {FeedbackStepData} from './types';
import {useFloatingTabBarClearance} from '@components/layout';

type Props = {
  navigation: {goBack: () => void};
  route: {params: {lessonId: string}};
};

export function ContentLessonRuntimeScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  const {lessonId} = route.params;
  const [session] = useState(() => createLessonRuntimeSession(lessonId));
  // Re-render on step advance / attempt recording — the session mutates in
  // place, so a simple render-tick counter is enough to reflect its state.
  const [, forceRerender] = useState(0);
  const [finished, setFinished] = useState<FeedbackStepData | null>(null);
  const [audioError, setAudioError] = useState<{
    assetId: string | null;
    message: string;
  } | null>(null);

  const step = session?.getCurrentStep() ?? null;
  const stepIndex = session?.getStepIndex() ?? 0;
  const totalSteps = session?.steps.length ?? 0;
  const learnerStepTotal = Math.max(totalSteps - 1, 1);
  const learnerStepNumber = Math.min(stepIndex + 1, learnerStepTotal);
  const progressFraction = learnerStepNumber / learnerStepTotal;

  const requestExit = useCallback(() => {
    if (!session || finished) {
      navigation.goBack();
      return;
    }
    const hasProgress = session.getStepIndex() > 0;
    if (!hasProgress) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Thoát bài học?',
      `Tiến độ bước ${learnerStepNumber}/${learnerStepTotal} sẽ không được lưu.`,
      [
        {text: 'Huỷ', style: 'cancel'},
        {
          text: 'Thoát',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  }, [finished, learnerStepNumber, learnerStepTotal, navigation, session]);

  const closeAction = (
    <IconButton
      accessibilityLabel="Đóng bài học"
      icon="close"
      onPress={requestExit}
      tone="bare"
      testID="lesson-runtime-close"
    />
  );

  function handlePlayAudio(assetId: string | null) {
    if (!session) {
      return;
    }
    const result = playContentAudio(assetId, session.data.audioAssets);
    setAudioError(result.ok ? null : {assetId, message: result.message});
  }

  function handlePreviousStep() {
    if (!session) {
      return;
    }
    if (session.goToPreviousStep()) {
      forceRerender(tick => tick + 1);
    }
  }

  function advance(
    state: 'completed' | 'skipped',
    checkAnswers: Array<{correct: boolean}> = [],
  ) {
    if (!session) {
      return;
    }
    const currentStep = session.getCurrentStep();
    session.recordAttempt(state);
    // The feedback step is a presentation state. Finalize as soon as the
    // exit check is submitted so the learner never lands on an unrendered
    // intermediate step.
    if (currentStep?.kind === 'exit_check' || session.isFinished()) {
      const result = session.finish();
      const check = evaluateCheck(
        currentStep?.kind === 'exit_check' ? checkAnswers : [],
      );
      setFinished({
        kind: 'feedback',
        newChunkCount: session.data.chunks.length,
        completedCount: result.completedStepCount,
        skippedCount: result.skippedStepCount,
        nextReviewHint:
          result.createdReviewItemCount > 0
            ? `${result.createdReviewItemCount} thẻ ôn tập mới sẽ xuất hiện vào ngày mai.`
            : 'Chưa có thẻ ôn tập mới cho lượt học này.',
        checkCorrectCount: check.correctCount,
        checkTotalCount: check.totalCount,
        checkScorePercentage: check.scorePercentage,
        checkOutcome: check.outcome,
        checkFeedbackVi: check.feedbackVi,
      });
      return;
    }
    forceRerender(tick => tick + 1);
  }

  if (!session) {
    return (
      <AppScreen>
        <ScreenHeader title="Bài học" rightAction={closeAction} />
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            padding: theme.spacing.xl,
          }}
        >
          <AppText color="danger">Không tìm thấy bài học.</AppText>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        title={session.data.lesson.titleVi}
        rightAction={closeAction}
      />
      {!finished && totalSteps > 0 ? (
        <View
          style={{
            gap: theme.spacing.sm,
            paddingHorizontal: theme.gutter,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <View testID="lesson-runtime-progress">
            <HandoffProgressTrack
              label={`${learnerStepNumber}/${learnerStepTotal}`}
              progress={progressFraction}
            />
          </View>
          {stepIndex > 0 ? (
            <Pressable
              accessibilityLabel="Bước trước"
              accessibilityRole="button"
              onPress={handlePreviousStep}
              style={{alignSelf: 'flex-start'}}
              testID="lesson-runtime-previous-step"
            >
              <AppText color="primary" variant="label">
                ← Bước trước
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          gap: theme.spacing.lg,
          justifyContent: 'center',
          padding: theme.gutter,
          paddingBottom: floatingClearance,
        }}
        style={{flex: 1}}
      >
        {audioError ? (
          <ErrorCard
            message={audioError.message}
            onRetry={() => handlePlayAudio(audioError.assetId)}
            retryLabel="Thử lại"
          />
        ) : null}
        {finished ? (
          <FeedbackCard data={finished} onFinish={() => navigation.goBack()} />
        ) : step?.kind === 'context' ? (
          <ContextCard
            data={step.data}
            onComplete={() => advance('completed')}
            onPlayAudio={handlePlayAudio}
            onSkip={() => advance('skipped')}
          />
        ) : step?.kind === 'guided_practice' ? (
          <GuidedPracticeCard
            data={step.data}
            onComplete={() => advance('completed')}
            onSkip={() => advance('skipped')}
          />
        ) : step?.kind === 'shadowing' ? (
          <ShadowingCard
            data={step.data}
            onComplete={() => advance('completed')}
            onPlayAudio={handlePlayAudio}
            onSkip={() => advance('skipped')}
          />
        ) : step?.kind === 'active_recall' ? (
          <ActiveRecallCard
            data={step.data}
            onComplete={() => advance('completed')}
            onSkip={() => advance('skipped')}
          />
        ) : step?.kind === 'role_play' ? (
          <RolePlayCard
            data={step.data}
            onComplete={() => advance('completed')}
            onPlayAudio={handlePlayAudio}
            onSkip={() => advance('skipped')}
          />
        ) : step?.kind === 'exit_check' ? (
          <ExitCheckCard
            data={step.data}
            onComplete={answers => advance('completed', answers)}
            onSkip={() => advance('skipped')}
          />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
