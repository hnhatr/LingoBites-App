import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppText} from '@ui/components/AppText';

import type {UnitProgress} from '../logic/unitProgress';

type Props = {
  progress: UnitProgress;
  testID?: string;
};

/**
 * Determinate "x/y bài" bar for one unit (completed lessons on device), with
 * "đạt z" once the Server counts lessons as passed (PR 16).
 */
export function UnitProgressBar({progress, testID}: Props) {
  const {t} = useTranslation();
  const label = progress.passed
    ? t('course.unit_progress_passed', {
        completed: progress.completed,
        total: progress.total,
        passed: progress.passed,
      })
    : t('course.unit_progress', {
        completed: progress.completed,
        total: progress.total,
      });

  return (
    <View
      accessibilityHint={t('course.unit_progress_hint')}
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: progress.total,
        now: progress.completed,
      }}
      style={styles.row}
      testID={testID}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.bar}
      >
        <AppProgressBar
          compact
          done={progress.completed}
          surface="card"
          total={progress.total}
        />
      </View>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
