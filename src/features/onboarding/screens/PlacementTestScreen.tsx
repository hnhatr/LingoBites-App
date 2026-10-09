import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {
  fetchPlacementTest,
  type PlacementQuestion,
  submitPlacement,
} from '../logic/learnerProfileClient';
import {useLearnerProfileStore} from '../logic/useLearnerProfileStore';
import type {OnboardingParamList, PlacementMode} from './navigationTypes';

type Props = {route: {params: {mode: PlacementMode}}};

type Phase =
  | {kind: 'loading'}
  | {kind: 'error'}
  | {kind: 'question'; questions: PlacementQuestion[]; index: number}
  | {kind: 'submitting'};

/**
 * Phase 2 (P2.4, C4): 12 listen-and-choose questions, read aloud on the
 * device. Grading happens on the Server. Leaving, or no network, means
 * "start from A1" during onboarding; from Settings it only goes back.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function PlacementTestScreen({route}: Props) {
  const {mode} = route.params;
  const {t} = useTranslation();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<OnboardingParamList, 'PlacementTest'>
    >();
  const save = useLearnerProfileStore(state => state.save);
  const profile = useLearnerProfileStore(state => state.profile);
  const [phase, setPhase] = useState<Phase>({kind: 'loading'});
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setPhase({kind: 'loading'});
    const result = await fetchPlacementTest();
    setPhase(
      result.ok && result.value.length > 0
        ? {kind: 'question', questions: result.value, index: 0}
        : {kind: 'error'},
    );
  }, []);

  useEffect(() => {
    load().catch(() => setPhase({kind: 'error'}));
  }, [load]);

  const question =
    phase.kind === 'question' ? phase.questions[phase.index] : null;

  useEffect(() => {
    if (question) speak(question.prompt_en).catch(() => {});
  }, [question]);

  async function leave() {
    if (mode === 'onboarding' && profile) {
      await save({...profile, levelCode: 'A1'}, {finish: true});
    } else {
      navigation.goBack();
    }
  }

  async function next() {
    if (phase.kind !== 'question') return;
    const {questions, index} = phase;
    if (index + 1 < questions.length) {
      setPhase({kind: 'question', questions, index: index + 1});
      return;
    }
    setPhase({kind: 'submitting'});
    const result = await submitPlacement(
      Object.entries(answers).map(([questionId, optionId]) => ({
        questionId,
        optionId,
      })),
    );
    if (!result.ok) {
      setPhase({kind: 'error'});
      return;
    }
    navigation.replace('PlacementResult', {
      mode,
      suggestedLevel: result.value.suggested_level,
      total: result.value.score.total,
      max: result.value.score.max,
    });
  }

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => {
          leave().catch(() => {});
        }}
        title={t('learnerOnboarding.test_title')}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {phase.kind === 'loading' || phase.kind === 'submitting' ? (
          <AppText color="secondary">{t('learnerOnboarding.loading')}</AppText>
        ) : null}
        {phase.kind === 'error' ? (
          <AppCard style={styles.card}>
            <AppText>{t('learnerOnboarding.test_unavailable')}</AppText>
            <AppButton
              onPress={() => {
                load().catch(() => {});
              }}
              testID="placement-retry"
              title={t('common.retry')}
            />
            <AppButton
              onPress={() => {
                leave().catch(() => {});
              }}
              testID="placement-leave"
              title={
                mode === 'onboarding'
                  ? t('learnerOnboarding.skip_test')
                  : t('learnerOnboarding.back')
              }
              variant="secondary"
            />
          </AppCard>
        ) : null}
        {phase.kind === 'question' && question ? (
          <AppCard style={styles.card}>
            <AppText color="secondary" variant="caption">
              {t('learnerOnboarding.question_count', {
                current: phase.index + 1,
                total: phase.questions.length,
              })}
            </AppText>
            <AppText>{question.prompt_vi}</AppText>
            <AppButton
              iconLeft="volume_up"
              onPress={() => {
                speak(question.prompt_en).catch(() => {});
              }}
              testID="placement-listen"
              title={t('learnerOnboarding.listen')}
              variant="secondary"
            />
            <View style={styles.options}>
              {question.options.map(option => (
                <AppButton
                  key={option.id}
                  onPress={() =>
                    setAnswers(previous => ({
                      ...previous,
                      [question.id]: option.id,
                    }))
                  }
                  testID={`placement-option-${option.id}`}
                  title={option.text}
                  variant={
                    answers[question.id] === option.id ? 'primary' : 'secondary'
                  }
                />
              ))}
            </View>
            <AppButton
              disabled={!answers[question.id]}
              onPress={() => {
                next().catch(() => setPhase({kind: 'error'}));
              }}
              testID="placement-next"
              title={
                phase.index + 1 < phase.questions.length
                  ? t('learnerOnboarding.next')
                  : t('learnerOnboarding.finish_test')
              }
            />
          </AppCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  container: {
    gap: 12,
    padding: 16,
  },
  options: {
    gap: 8,
  },
});
