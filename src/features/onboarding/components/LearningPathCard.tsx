import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';

import {useOptionalAppNavigation} from '@core/navigation';

import {useLearningPath} from '../logic/useLearningPath';

/**
 * Phase 2 (P2.4): the learner's starting point on Home — the level chosen at
 * onboarding (or after the placement test), opening its units. Hidden until
 * the level is known.
 */
export function LearningPathCard() {
  const {t} = useTranslation();
  const navigation = useOptionalAppNavigation();
  const path = useLearningPath();
  if (!path || !navigation) return null;

  return (
    <AppCard style={styles.card} testID="learning-path-card">
      <AppText color="secondary" variant="caption">
        {t('learnerOnboarding.path_label')}
      </AppText>
      <AppText variant="h3">{path.title}</AppText>
      <AppButton
        onPress={() =>
          navigation.openCourse({
            kind: 'level',
            levelId: path.levelId,
            title: path.title,
          })
        }
        testID="learning-path-open"
        title={t('learnerOnboarding.path_open')}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
});
