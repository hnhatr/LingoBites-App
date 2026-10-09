import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';

import {DEFAULT_PROFILE, type LevelCode} from '../logic/profileOptions';
import {useLearnerProfileStore} from '../logic/useLearnerProfileStore';
import type {
  OnboardingParamList,
  PlacementResultRouteParams,
} from './navigationTypes';

type Props = {route: {params: PlacementResultRouteParams}};

/**
 * Phase 2 (P2.4, C4): the suggested level. It is only a suggestion: both
 * levels can be picked here, and changed later in Settings.
 */
export function PlacementResultScreen({route}: Props) {
  const {mode, suggestedLevel, total, max} = route.params;
  const {t} = useTranslation();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<OnboardingParamList, 'PlacementResult'>
    >();
  const profile = useLearnerProfileStore(state => state.profile);
  const save = useLearnerProfileStore(state => state.save);
  const [busy, setBusy] = useState(false);
  const other: LevelCode = suggestedLevel === 'A2' ? 'A1' : 'A2';

  async function choose(levelCode: LevelCode) {
    setBusy(true);
    try {
      await save(
        {...(profile ?? DEFAULT_PROFILE), levelCode},
        {finish: mode === 'onboarding'},
      );
    } finally {
      setBusy(false);
    }
    if (mode === 'settings') navigation.goBack();
  }

  return (
    <AppScreen>
      <View style={styles.container}>
        <AppCard style={styles.card}>
          <AppText color="secondary">
            {t('learnerOnboarding.result_score', {total, max})}
          </AppText>
          <AppText variant="h2">
            {t('learnerOnboarding.result_title', {level: suggestedLevel})}
          </AppText>
          <AppText color="secondary">
            {t(`learnerOnboarding.result_body_${suggestedLevel}`)}
          </AppText>
          <AppButton
            disabled={busy}
            loading={busy}
            onPress={() => {
              choose(suggestedLevel).catch(() => {});
            }}
            testID="placement-accept"
            title={t('learnerOnboarding.start_level', {level: suggestedLevel})}
          />
          <AppButton
            disabled={busy}
            onPress={() => {
              choose(other).catch(() => {});
            }}
            testID="placement-other"
            title={t('learnerOnboarding.choose_level', {level: other})}
            variant="secondary"
          />
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
});
