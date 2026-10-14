import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

import {type UnitProgress, unitProgressRatio} from '../logic/unitProgress';

type Props = {
  progress: UnitProgress;
  size?: number;
  testID?: string;
};

const STROKE = 6;

/** Round "x/y bài" of one unit's completed lessons, for the unit header. */
export function UnitProgressRing({progress, size = 68, testID}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const ratio = unitProgressRatio(progress);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
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
      accessible
      style={{height: size, width: size}}
      testID={testID}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={theme.colors.surfaceHigh}
          strokeWidth={STROKE}
        />
        {ratio > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            origin={`${size / 2}, ${size / 2}`}
            r={radius}
            rotation={-90}
            stroke={theme.colors.primary}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            strokeLinecap="round"
            strokeWidth={STROKE}
          />
        ) : null}
      </Svg>
      <View style={styles.center}>
        <AppText variant="h3">
          {progress.completed}/{progress.total}
        </AppText>
        <AppText color="muted" style={styles.unit} variant="caption">
          {t('course.lessons_unit')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  unit: {
    fontSize: 10,
    lineHeight: 12,
  },
});
