import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerFooter} from '@ui/components/StickerFooter';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {useAppTheme} from '@ui/theme';

import {
  IconChip,
  LevelTile,
  NumberTiles,
  RowLink,
  SectionCard,
} from '../components/LearningProfileParts';
import {
  DAILY_MINUTES,
  type DailyMinutes,
  DEFAULT_PROFILE,
  type Goal,
  GOALS,
  type Interest,
  INTERESTS,
  INTERESTS_MAX,
  type LearnerProfileInput,
  LEVEL_CODES,
  toggleChoice,
} from '../logic/profileOptions';
import {useLearnerProfileStore} from '../logic/useLearnerProfileStore';
import type {OnboardingParamList} from './navigationTypes';

const GOAL_ICONS: Record<Goal, HandoffIconName> = {
  communication: 'record_voice_over',
  travel: 'language',
  work: 'article',
  school: 'school',
};

const INTEREST_ICONS: Record<Interest, HandoffIconName> = {
  music: 'volume_up',
  movies: 'play_circle',
  sports: 'fitness_center',
  cooking: 'restaurant_menu',
  travel: 'language',
  technology: 'smartphone',
  reading: 'auto_stories',
  games: 'emoji_events',
};

function sameProfile(a: LearnerProfileInput, b: LearnerProfileInput): boolean {
  const sameSet = (x: readonly string[], y: readonly string[]) =>
    x.length === y.length && x.every(entry => y.includes(entry));
  return (
    a.ageGroup === b.ageGroup &&
    a.levelCode === b.levelCode &&
    a.dailyMinutes === b.dailyMinutes &&
    sameSet(a.goals, b.goals) &&
    sameSet(a.interests, b.interests)
  );
}

/**
 * Phase 2 (P2.4): the onboarding answers, editable from the Profile tab:
 * level (C4: the learner may always change it), goals, interests, daily
 * minutes, and taking the placement test again. The age group is asked at
 * onboarding only; the stored answer is kept as is.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function LearningProfileScreen() {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
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
  const [interestsCapHit, setInterestsCapHit] = useState(false);
  const update = (patch: Partial<LearnerProfileInput>) =>
    setDraft(previous => ({...previous, ...patch}));
  const storedLevel = stored?.levelCode;
  // Nothing stored yet: saving still records the defaults.
  const dirty = !stored || !sameProfile(draft, stored);
  const interestsFull = draft.interests.length >= INTERESTS_MAX;

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

  function toggleInterest(interest: Interest) {
    const isOn = draft.interests.includes(interest);
    setInterestsCapHit(!isOn && interestsFull);
    update({
      interests: toggleChoice(draft.interests, interest, INTERESTS_MAX),
    });
  }

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('learnerOnboarding.profile_title')}
      />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {gap: theme.spacing.md, paddingHorizontal: theme.gutter},
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard
          hint={t('learnerOnboarding.level_section_hint')}
          icon="analytics"
          testID="profile-level"
          title={t('learnerOnboarding.level_title')}
          tone="teal"
        >
          <View style={[styles.row, {gap: theme.spacing.sm}]}>
            {LEVEL_CODES.map(code => (
              <LevelTile
                code={code}
                description={t(`learnerOnboarding.level_hint.${code}`)}
                key={code}
                name={t(`learnerOnboarding.level_name.${code}`)}
                onPress={() => update({levelCode: code})}
                selected={draft.levelCode === code}
                testID={`profile-level-${code}`}
              />
            ))}
          </View>
          <RowLink
            caption={t('learnerOnboarding.retake_test_hint')}
            icon="refresh"
            onPress={() =>
              navigation.navigate('PlacementTest', {mode: 'settings'})
            }
            testID="profile-retake-test"
            title={t('learnerOnboarding.retake_test')}
          />
        </SectionCard>

        <SectionCard
          hint={t('learnerOnboarding.goals_hint')}
          icon="flag"
          testID="profile-goals"
          title={t('learnerOnboarding.goals_title')}
          tone="coral"
        >
          <View style={[styles.chips, {gap: theme.spacing.sm}]}>
            {GOALS.map(goal => (
              <IconChip
                icon={GOAL_ICONS[goal]}
                key={goal}
                label={t(`learnerOnboarding.goal.${goal}`)}
                onPress={() => {
                  const goals = toggleChoice(draft.goals, goal);
                  if (goals.length > 0) update({goals});
                }}
                selected={draft.goals.includes(goal)}
                testID={`profile-goals-${goal}`}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard
          count={{
            full: interestsFull,
            label: `${draft.interests.length}/${INTERESTS_MAX}`,
          }}
          hint={t('learnerOnboarding.interests_short_hint', {
            max: INTERESTS_MAX,
          })}
          icon="auto_awesome"
          testID="profile-interests"
          title={t('learnerOnboarding.interests_title')}
          tone="teal"
        >
          <View style={[styles.chips, {gap: theme.spacing.sm}]}>
            {INTERESTS.map(interest => {
              const selected = draft.interests.includes(interest);
              return (
                <IconChip
                  dimmed={interestsFull && !selected}
                  icon={INTEREST_ICONS[interest]}
                  key={interest}
                  label={t(`learnerOnboarding.interest.${interest}`)}
                  onPress={() => toggleInterest(interest)}
                  selected={selected}
                  testID={`profile-interests-${interest}`}
                />
              );
            })}
          </View>
          {interestsCapHit ? (
            <AppText style={{color: theme.colors.onTertiaryContainer}}>
              {t('learnerOnboarding.interests_full', {max: INTERESTS_MAX})}
            </AppText>
          ) : null}
        </SectionCard>

        <SectionCard
          icon="schedule"
          testID="profile-minutes"
          title={t('learnerOnboarding.minutes_title')}
          tone="gold"
        >
          <NumberTiles
            onSelect={value => update({dailyMinutes: value as DailyMinutes})}
            selected={draft.dailyMinutes}
            testID="profile-minutes"
            unit={t('learnerOnboarding.minutes_unit')}
            values={DAILY_MINUTES}
          />
        </SectionCard>
      </ScrollView>
      <StickerFooter
        note={pending ? t('learnerOnboarding.pending_sync') : null}
      >
        <AppButton
          disabled={busy || !dirty}
          loading={busy}
          onPress={() => {
            onSave().catch(() => {});
          }}
          testID="profile-save"
          title={
            dirty
              ? t('learnerOnboarding.save_changes')
              : t('learnerOnboarding.saved')
          }
        />
      </StickerFooter>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  container: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
});
