import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';
import {getGamificationSnapshot} from '@features/engagement';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import {useAppNavigation} from '@core/navigation';
import type {LessonBlock} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';

import {isLessonNotDownloaded} from '../../player/logic/lessonNotDownloaded';
import {useCanonicalLesson} from '../../player/logic/useCanonicalLesson';
import type {LessonFlowParamList} from '../../player/screens/navigationTypes';
import {CoachBubble} from '../components/CoachBubble';
import {
  FlowFooterBar,
  FlowFooterProvider,
  useFlowFooterHost,
} from '../components/FlowFooter';
import {FlowProgressBar} from '../components/FlowProgressBar';
import {LessonMap} from '../components/LessonMap';
import {StepResult} from '../components/StepResult';
import {hasRelatedReview, StepReview} from '../components/StepReview';
import {StepView} from '../components/StepView';
import {flowActivity, flowItems} from '../logic/flowContent';
import {useNoSpeaking} from '../logic/noSpeaking';
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
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function LessonFlowPlayerScreen({navigation, route}: Props) {
  const {lessonId} = route.params;
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const {state, open} = useCanonicalLesson(lessonId);
  const appNavigation = useAppNavigation();
  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const runnable = snapshot !== null && isFlowLesson(snapshot);
  const flow = useLessonFlow(lessonId, runnable ? snapshot : null);
  const noSpeaking = useNoSpeaking();
  const items = useMemo(
    () => (snapshot ? flowItems(snapshot) : new Map()),
    [snapshot],
  );

  useEffect(() => {
    open();
  }, [open]);

  /** Step 1 with nothing to review is skipped (redesign: no empty screen). */
  const reviewSkipped = useMemo(
    () => (snapshot && runnable ? !hasRelatedReview(snapshot) : false),
    [snapshot, runnable],
  );
  const skippedSteps = useMemo(
    () => new Set<number>(reviewSkipped ? [1] : []),
    [reviewSkipped],
  );

  // A curriculum lesson knows its unit: step 6 offers the next lesson.
  const unit = snapshot?.unit ?? null;
  const unitTarget = useMemo(
    () =>
      unit ? {unitId: unit.unit_id, title: unit.unit_title, lessonId} : null,
    [unit, lessonId],
  );

  const goTo = flow.goTo;
  /** Redesign: the lesson map, shown once before anything was done. */
  const [showMap, setShowMap] = useState(false);
  const [streakDays] = useState(readStreakDays);
  const footer = useFlowFooterHost();
  const openStep = useCallback(
    (step: FlowStep) => {
      setShowMap(false);
      goTo(step);
      scrollRef.current?.scrollTo({y: 0, animated: false});
    },
    [goTo],
  );

  // A new lesson opens on its map; step 1 with nothing to review is skipped.
  const firstStepChecked = useRef(false);
  useEffect(() => {
    if (firstStepChecked.current || flow.step === null) return;
    firstStepChecked.current = true;
    if (flow.attempts.length === 0) setShowMap(true);
    if (flow.step === 1 && reviewSkipped) goTo(2);
  }, [flow.step, flow.attempts.length, reviewSkipped, goTo]);

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
              : isLessonNotDownloaded(state)
              ? t('lessonPlayer.not_downloaded')
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
    if (showMap) {
      return (
        <LessonMap
          nextStep={step}
          onOpenStep={openStep}
          skippedSteps={skippedSteps}
          snapshot={snapshot}
        />
      );
    }
    return (
      <>
        <View style={themedStyles.titleRow}>
          <AppText
            numberOfLines={2}
            style={themedStyles.flex}
            testID="lesson-flow-step-title"
            variant="h3"
          >
            {t('lessonFlow.step_heading', {
              step,
              label: t(STEP_LABEL_KEYS[step]),
            })}
          </AppText>
          {step >= 3 && step <= 5 && !noSpeaking.active ? (
            <Chip
              accessibilityHint={t('lessonFlow.no_speaking_hint')}
              label={t('lessonFlow.no_speaking_short')}
              onPress={noSpeaking.start}
              testID="lesson-flow-cannot-speak"
              tone="neutral"
            />
          ) : null}
        </View>
        {step >= 3 && step <= 5 && noSpeaking.active ? (
          <View
            style={themedStyles.noSpeaking}
            testID="lesson-flow-no-speaking"
          >
            <AppText
              color="secondary"
              style={themedStyles.flex}
              variant="label"
            >
              {t('lessonFlow.no_speaking_active')}
            </AppText>
            <Chip
              accessibilityHint={t('lessonFlow.can_speak_again')}
              label={t('lessonFlow.can_speak_again')}
              onPress={noSpeaking.stop}
              testID="lesson-flow-can-speak"
              tone="accentSoft"
            />
          </View>
        ) : null}
        {step <= 5 && !(step === 1 && reviewSkipped) ? (
          <CoachBubble
            testID="lesson-flow-coach"
            text={t(`lessonFlow.coach_step_${step}`)}
          />
        ) : null}
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
            onBackToUnit={
              unitTarget
                ? () => appNavigation.closeLessonToUnit(unitTarget)
                : undefined
            }
            onClose={navigation.goBack}
            onNextLesson={
              unitTarget
                ? () => appNavigation.openNextUnitLesson(unitTarget)
                : undefined
            }
            onOpenStep={openStep}
            practiceDone={flow.practiceDone}
            practiceRemaining={flow.practiceRemaining}
            snapshot={snapshot}
            streakDays={streakDays}
          />
        ) : step === 1 && blocksOfStep(snapshot, 1).length === 0 ? null : (
          <StepView
            attempts={flow.attempts}
            key={step}
            items={items}
            onFinished={handleFinished}
            onOpenStep={next => openStep(next as FlowStep)}
            speakingOff={noSpeaking.active}
            onSpeakText={handleSpeak}
            snapshot={snapshot}
            step={step}
          />
        )}
      </>
    );
  };

  const shownStep = state.status === 'ready' && runnable ? flow.step : null;

  const defaultAction =
    shownStep === null
      ? null
      : showMap
      ? {
          title: t('lessonFlow.map_start'),
          hint: t('lessonFlow.map_start_hint'),
          testID: 'lesson-flow-map-start',
          onPress: () => openStep(shownStep),
        }
      : shownStep < 6
      ? {
          title: t('lessonFlow.continue'),
          hint: t('lessonFlow.next_step_hint'),
          testID: 'lesson-flow-next',
          onPress: () => openStep((shownStep + 1) as FlowStep),
        }
      : null;
  const footerAction = (!showMap && footer.action) || defaultAction;

  return (
    <AppScreen>
      <FlowFooterProvider register={footer.register}>
        {shownStep !== null && showMap ? (
          <View style={themedStyles.header}>
            <IconButton
              accessibilityHint={t('lessonFlow.close_lesson_hint')}
              accessibilityLabel={t('lessonFlow.close_lesson')}
              icon="close"
              onPress={appNavigation.closeLesson}
              style={themedStyles.mapClose}
              testID="lesson-flow-close"
              tone="surface"
            />
            <AppText
              color="secondary"
              numberOfLines={1}
              style={themedStyles.flex}
              variant="label"
            >
              {unit?.unit_title ?? t('lessonFlow.map_lesson')}
            </AppText>
            {streakDays ? (
              <View style={themedStyles.streak} testID="lesson-flow-map-streak">
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="local_fire_department"
                  size={18}
                />
                <AppText style={themedStyles.streakText} variant="label">
                  {t('lessonFlow.map_streak_short', {count: streakDays})}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={themedStyles.header}>
            <IconButton
              accessibilityHint={t('lessonFlow.close_lesson_hint')}
              accessibilityLabel={t('lessonFlow.close_lesson')}
              icon="close"
              onPress={appNavigation.closeLesson}
              testID="lesson-flow-close"
              tone="bare"
            />
            {shownStep !== null ? (
              <FlowProgressBar
                doneSteps={doneSteps}
                onSelect={openStep}
                skippedSteps={skippedSteps}
                step={shownStep}
              />
            ) : (
              <AppText numberOfLines={1} style={themedStyles.flex} variant="h3">
                {t('lessonFlow.title')}
              </AppText>
            )}
          </View>
        )}
        <ScrollView
          contentContainerStyle={themedStyles.content}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={themedStyles.scroll}
          testID="lesson-flow-screen"
        >
          {renderBody()}
        </ScrollView>
        {footerAction ? <FlowFooterBar action={footerAction} /> : null}
      </FlowFooterProvider>
    </AppScreen>
  );
}

function readStreakDays(): number | null {
  try {
    return getGamificationSnapshot().currentStreak;
  } catch {
    return null;
  }
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
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingRight: theme.gutter,
      paddingTop: theme.spacing.xs,
    },
    noSpeaking: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    mapClose: {
      ...getStickerFace(theme, 3),
    },
    streak: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiaryFixed,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      ...getStickerFace(theme, 0),
    },
    streakText: {
      color: theme.colors.onTertiaryContainer,
      fontWeight: theme.typography.weight.bold,
    },
    titleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    scroll: {
      flex: 1,
    },
  });
}
