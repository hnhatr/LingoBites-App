import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import type {LessonBlock} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';

import {useCanonicalLesson} from '../../player/logic/useCanonicalLesson';
import type {LessonFlowParamList} from '../../player/screens/navigationTypes';
import {StepRail} from '../components/StepRail';
import {StepResult} from '../components/StepResult';
import {StepReview} from '../components/StepReview';
import {StepView} from '../components/StepView';
import {flowActivity, flowItems} from '../logic/flowContent';
import {
  blocksOfStep,
  type FlowStep,
  isFlowLesson,
} from '../logic/practiceCompletion';
import {useLessonFlow} from '../logic/useLessonFlow';

type Props = NativeStackScreenProps<LessonFlowParamList, 'LessonFlowPlayer'>;

const STEP_LABEL_KEYS: Record<FlowStep, string> = {
  1: 'lessonFlow.step_1',
  2: 'lessonFlow.step_2',
  3: 'lessonFlow.step_3',
  4: 'lessonFlow.step_4',
  5: 'lessonFlow.step_5',
  6: 'lessonFlow.step_6',
};

/**
 * PR 10: a curriculum lesson run step by step, 1 → 6 (decision G1). Opens
 * where the learner left off; every finished activity block is stored as one
 * attempt and synced. Works on the downloaded snapshot, offline included.
 */
export function LessonFlowPlayerScreen({navigation, route}: Props) {
  const {lessonId} = route.params;
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const floatingClearance = useFloatingTabBarClearance();
  const scrollRef = useRef<ScrollView>(null);
  const {state, open} = useCanonicalLesson(lessonId);
  const appNavigation = useAppNavigation();
  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const runnable = snapshot !== null && isFlowLesson(snapshot);
  const flow = useLessonFlow(lessonId, runnable ? snapshot : null);
  const items = useMemo(
    () => (snapshot ? flowItems(snapshot) : new Map()),
    [snapshot],
  );

  useEffect(() => {
    open();
  }, [open]);

  const goTo = flow.goTo;
  const openStep = useCallback(
    (step: FlowStep) => {
      goTo(step);
      scrollRef.current?.scrollTo({y: 0, animated: false});
    },
    [goTo],
  );

  const handleSpeak = useCallback((text: string) => {
    speak(text).catch(() => undefined);
  }, []);

  const finishActivity = flow.finishActivity;
  const handleFinished = useCallback(
    (
      block: LessonBlock,
      outcome: LessonAttemptOutcome,
      supportLevel: LessonSupportLevel,
      durationMs: number,
      graded?: {attemptId: string; recordingClientId?: string},
    ) => finishActivity({block, outcome, supportLevel, durationMs, graded}),
    [finishActivity],
  );

  /** Steps 2–5 whose activities all have an attempt. */
  const doneSteps = useMemo(() => {
    const done = new Set<number>();
    if (!snapshot) return done;
    const attempted = new Set(flow.attempts.map(attempt => attempt.blockId));
    for (const step of [2, 3, 4, 5]) {
      const activities = snapshot.blocks.filter(
        block => block.step === step && flowActivity(block) !== null,
      );
      if (
        activities.length > 0 &&
        activities.every(block => attempted.has(block.id))
      ) {
        done.add(step);
      }
    }
    return done;
  }, [snapshot, flow.attempts]);

  const renderBody = () => {
    if (state.status === 'idle' || state.status === 'loading') {
      return (
        <View style={themedStyles.centered}>
          <ActivityIndicator
            color={theme.colors.primary}
            size="large"
            testID="lesson-flow-loading"
          />
        </View>
      );
    }
    if (state.status !== 'ready') {
      return (
        <View style={themedStyles.centered}>
          <AppText color="secondary" testID="lesson-flow-unavailable">
            {state.status === 'contract-mismatch'
              ? t('lessonPlayer.update_app')
              : t('lessonFlow.unavailable')}
          </AppText>
          {state.status === 'error' ? (
            <AppButton
              accessibilityHint={t('lessonPlayer.retry_load_hint')}
              onPress={open}
              testID="lesson-flow-retry"
              title={t('common.retry')}
              variant="secondary"
            />
          ) : null}
        </View>
      );
    }
    if (!snapshot || !runnable) {
      return (
        <AppText color="secondary" testID="lesson-flow-not-curriculum">
          {t('lessonFlow.not_curriculum')}
        </AppText>
      );
    }
    const step = flow.step;
    if (step === null) return null;
    return (
      <>
        <AppText
          numberOfLines={2}
          testID="lesson-flow-lesson-title"
          variant="h3"
        >
          {snapshot.title}
        </AppText>
        <StepRail doneSteps={doneSteps} onSelect={openStep} step={step} />
        <AppText testID="lesson-flow-step-title" variant="h2">
          {t('lessonFlow.step_heading', {
            step,
            label: t(STEP_LABEL_KEYS[step]),
          })}
        </AppText>
        {step === 1 ? (
          <StepReview
            onOpenLesson={appNavigation.openLesson}
            onSpeakText={handleSpeak}
            snapshot={snapshot}
          />
        ) : null}
        {step === 6 ? (
          <StepResult
            attempts={flow.attempts}
            onClose={navigation.goBack}
            onOpenStep={openStep}
            practiceDone={flow.practiceDone}
            practiceRemaining={flow.practiceRemaining}
            snapshot={snapshot}
          />
        ) : step === 1 && blocksOfStep(snapshot, 1).length === 0 ? null : (
          <StepView
            attempts={flow.attempts}
            items={items}
            onFinished={handleFinished}
            onOpenStep={next => openStep(next as FlowStep)}
            onSpeakText={handleSpeak}
            snapshot={snapshot}
            step={step}
          />
        )}
        <View style={themedStyles.nav}>
          <AppButton
            accessibilityHint={t('lessonFlow.previous_step_hint')}
            disabled={step === 1}
            onPress={() => openStep((step - 1) as FlowStep)}
            style={themedStyles.flex}
            testID="lesson-flow-previous"
            title={t('lessonFlow.previous_step')}
            variant="outline"
          />
          {step < 6 ? (
            <AppButton
              accessibilityHint={t('lessonFlow.next_step_hint')}
              onPress={() => openStep((step + 1) as FlowStep)}
              style={themedStyles.flex}
              testID="lesson-flow-next"
              title={t('lessonFlow.next_step')}
            />
          ) : null}
        </View>
      </>
    );
  };

  return (
    <AppScreen>
      <ScreenHeader onBack={navigation.goBack} title={t('lessonFlow.title')} />
      <ScrollView
        contentContainerStyle={[
          themedStyles.content,
          {paddingBottom: floatingClearance},
        ]}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={themedStyles.scroll}
        testID="lesson-flow-screen"
      >
        {renderBody()}
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    centered: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
    },
    content: {
      gap: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    nav: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    scroll: {
      flex: 1,
    },
  });
}
