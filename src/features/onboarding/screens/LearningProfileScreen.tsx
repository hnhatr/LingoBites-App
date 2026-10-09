import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {OptionChips} from '../components/OptionChips';
import {
  AGE_GROUPS,
  DAILY_MINUTES,
  DEFAULT_PROFILE,
  GOALS,
  INTERESTS,
  INTERESTS_MAX,
  type LearnerProfileInput,
  LEVEL_CODES,
  toggleChoice,
} from '../logic/profileOptions';
import {useLearnerProfileStore} from '../logic/useLearnerProfileStore';
import type {OnboardingParamList} from './navigationTypes';

/**
 * Phase 2 (P2.4): the onboarding answers, editable from the Profile tab:
 * age group, level (C4: the learner may always change it), goals,
 * interests, daily minutes, and taking the placement test again.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function LearningProfileScreen() {
  const {t} = useTranslation();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<OnboardingParamList, 'LearningProfile'>
    >();
  const stored = useLearnerProfileStore(state => state.profile);
  const pending = useLearnerProfileStore(state => state.pending);
  const save = useLearnerProfileStore(state => state.save);
  const [draft, setDraft] = useState<LearnerProfileInput>(
    stored ?? DEFAULT_PROFILE,
  );
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<LearnerProfileInput>) =>
    setDraft(previous => ({...previous, ...patch}));
  const storedLevel = stored?.levelCode;

  // A level picked after retaking the placement test shows up here.
  useEffect(() => {
    if (storedLevel) update({levelCode: storedLevel});
  }, [storedLevel]);

  async function onSave() {
    setBusy(true);
    try {
      await save(draft);
    } finally {
      setBusy(false);
    }
    navigation.goBack();
  }

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('learnerOnboarding.profile_title')}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <OptionChips
          onToggle={levelCode => update({levelCode})}
          options={LEVEL_CODES.map(value => ({
            value,
            label: t(`learnerOnboarding.level.${value}`),
          }))}
          selected={[draft.levelCode]}
          testID="profile-level"
          title={t('learnerOnboarding.level_title')}
        />
        <AppButton
          onPress={() =>
            navigation.navigate('PlacementTest', {mode: 'settings'})
          }
          testID="profile-retake-test"
          title={t('learnerOnboarding.retake_test')}
          variant="secondary"
        />
        <OptionChips
          onToggle={ageGroup => update({ageGroup})}
          options={AGE_GROUPS.map(value => ({
            value,
            label: t(`learnerOnboarding.age.${value}`),
          }))}
          selected={[draft.ageGroup]}
          testID="profile-age"
          title={t('learnerOnboarding.age_title')}
        />
        <OptionChips
          onToggle={goal => {
            const goals = toggleChoice(draft.goals, goal);
            if (goals.length > 0) update({goals});
          }}
          options={GOALS.map(value => ({
            value,
            label: t(`learnerOnboarding.goal.${value}`),
          }))}
          selected={draft.goals}
          testID="profile-goals"
          title={t('learnerOnboarding.goals_title')}
        />
        <OptionChips
          hint={t('learnerOnboarding.interests_hint', {max: INTERESTS_MAX})}
          onToggle={interest =>
            update({
              interests: toggleChoice(draft.interests, interest, INTERESTS_MAX),
            })
          }
          options={INTERESTS.map(value => ({
            value,
            label: t(`learnerOnboarding.interest.${value}`),
          }))}
          selected={draft.interests}
          testID="profile-interests"
          title={t('learnerOnboarding.interests_title')}
        />
        <OptionChips
          onToggle={dailyMinutes => update({dailyMinutes})}
          options={DAILY_MINUTES.map(value => ({
            value,
            label: t('learnerOnboarding.minutes', {count: value}),
          }))}
          selected={[draft.dailyMinutes]}
          testID="profile-minutes"
          title={t('learnerOnboarding.minutes_title')}
        />
        {pending ? (
          <AppText color="secondary" variant="caption">
            {t('learnerOnboarding.pending_sync')}
          </AppText>
        ) : null}
        <AppButton
          disabled={busy}
          loading={busy}
          onPress={() => {
            onSave().catch(() => {});
          }}
          testID="profile-save"
          title={t('learnerOnboarding.save')}
        />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 16,
  },
});
