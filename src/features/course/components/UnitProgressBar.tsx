import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {type UnitProgress, unitProgressRatio} from '../logic/unitProgress';

type Props = {
  progress: UnitProgress;
  testID?: string;
};

/**
 * Determinate "x/y bài" bar for one unit (completed lessons on device), with
 * "đạt z" once the Server counts lessons as passed (PR 16).
 */
export function UnitProgressBar({progress, testID}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
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
      <View style={themedStyles.track}>
        <View
          style={[
            themedStyles.fill,
            {width: `${unitProgressRatio(progress) * 100}%`},
          ]}
          testID={testID ? `${testID}-fill` : undefined}
        />
      </View>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    fill: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      height: '100%',
    },
    track: {
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.radius.pill,
      flex: 1,
      height: 6,
      overflow: 'hidden',
    },
  });
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
