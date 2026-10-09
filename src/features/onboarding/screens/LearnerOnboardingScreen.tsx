import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';

import {OptionChips} from '../components/OptionChips';
import {
  AGE_GROUPS,
  DAILY_MINUTES,
  DEFAULT_PROFILE,
  GOALS,
  INTERESTS,
  INTERESTS_MAX,
  type LearnerProfileInput,
  toggleChoice,
} from '../logic/profileOptions';
import {useLearnerProfileStore} from '../logic/useLearnerProfileStore';
import type {OnboardingParamList} from './navigationTypes';

const STEPS = ['age', 'goals', 'interests', 'minutes', 'placement'] as const;

/**
 * Phase 2 (P2.4, decisions C4–C5): after the name, five short steps — age
 * group, goals, interests, daily minutes — then the placement test or "start
 * from A1". "Để sau" on the first step keeps the defaults (adult, A1).
 * Nothing here needs the network; answers are sent when it is back.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function LearnerOnboardingScreen() {
  const {t} = useTranslation();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<OnboardingParamList, 'LearnerOnboarding'>
    >();
  const save = useLearnerProfileStore(state => state.save);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<LearnerProfileInput>(DEFAULT_PROFILE);
  const [busy, setBusy] = useState(false);
  const current = STEPS[step];

  const update = (patch: Partial<LearnerProfileInput>) =>
    setDraft(previous => ({...previous, ...patch}));

  async function finish(profile: LearnerProfileInput) {
    setBusy(true);
    try {
      await save(profile, {finish: true});
    } finally {
      setBusy(false);
    }
  }

  async function startPlacement() {
    setBusy(true);
    try {
      // Saved first, so the Server keeps the placement result on it.
      await save(draft);
    } finally {
      setBusy(false);
    }
    navigation.navigate('PlacementTest', {mode: 'onboarding'});
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText color="secondary" variant="caption">
          {t('learnerOnboarding.step', {
            current: step + 1,
            total: STEPS.length,
          })}
        </AppText>
        <AppCard style={styles.card}>
          {current === 'age' ? (
            <OptionChips
              onToggle={ageGroup => update({ageGroup})}
              options={AGE_GROUPS.map(value => ({
                value,
                label: t(`learnerOnboarding.age.${value}`),
              }))}
              selected={[draft.ageGroup]}
              testID="onboarding-age"
              title={t('learnerOnboarding.age_title')}
            />
          ) : null}
          {current === 'goals' ? (
            <OptionChips
              hint={t('learnerOnboarding.goals_hint')}
              onToggle={goal => {
                const goals = toggleChoice(draft.goals, goal);
                if (goals.length > 0) update({goals});
              }}
              options={GOALS.map(value => ({
                value,
                label: t(`learnerOnboarding.goal.${value}`),
              }))}
              selected={draft.goals}
              testID="onboarding-goals"
              title={t('learnerOnboarding.goals_title')}
            />
          ) : null}
          {current === 'interests' ? (
            <OptionChips
              hint={t('learnerOnboarding.interests_hint', {max: INTERESTS_MAX})}
              onToggle={interest =>
                update({
                  interests: toggleChoice(
                    draft.interests,
                    interest,
                    INTERESTS_MAX,
                  ),
                })
              }
              options={INTERESTS.map(value => ({
                value,
                label: t(`learnerOnboarding.interest.${value}`),
              }))}
              selected={draft.interests}
              testID="onboarding-interests"
              title={t('learnerOnboarding.interests_title')}
            />
          ) : null}
          {current === 'minutes' ? (
            <OptionChips
              onToggle={dailyMinutes => update({dailyMinutes})}
              options={DAILY_MINUTES.map(value => ({
                value,
                label: t('learnerOnboarding.minutes', {count: value}),
              }))}
              selected={[draft.dailyMinutes]}
              testID="onboarding-minutes"
              title={t('learnerOnboarding.minutes_title')}
            />
          ) : null}
          {current === 'placement' ? (
            <View style={styles.placement}>
              <AppText variant="h3">
                {t('learnerOnboarding.placement_title')}
              </AppText>
              <AppText color="secondary">
                {t('learnerOnboarding.placement_body')}
              </AppText>
              <AppButton
                disabled={busy}
                loading={busy}
                onPress={startPlacement}
                testID="onboarding-take-test"
                title={t('learnerOnboarding.take_test')}
              />
              <AppButton
                disabled={busy}
                onPress={() => finish({...draft, levelCode: 'A1'})}
                testID="onboarding-skip-test"
                title={t('learnerOnboarding.skip_test')}
                variant="secondary"
              />
            </View>
          ) : null}
        </AppCard>

        {current !== 'placement' ? (
          <AppButton
            onPress={() => setStep(step + 1)}
            testID="onboarding-next"
            title={t('learnerOnboarding.next')}
          />
        ) : null}
        {step > 0 ? (
          <AppButton
            disabled={busy}
            onPress={() => setStep(step - 1)}
            testID="onboarding-back"
            title={t('learnerOnboarding.back')}
            variant="secondary"
          />
        ) : (
          <AppButton
            disabled={busy}
            onPress={() => finish(DEFAULT_PROFILE)}
            testID="onboarding-later"
            title={t('learnerOnboarding.later')}
            variant="secondary"
          />
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  container: {
    flexGrow: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 16,
  },
  placement: {
    gap: 12,
  },
});
