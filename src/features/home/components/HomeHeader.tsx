/**
 * HomeHeader — time-of-day greeting with streak flame badge.
 * No app brand name (DQ-008, D7). Covers I4, I5, P-001.
 *
 * Motion (AD-002):
 *   - I4 (flame wiggle): disabled under reduced motion
 *   - I5 (greeting fade-in): static under reduced motion
 *
 * Gap 3 (LING-261): two-line greeting when a name is present — small greeting
 *   prefix + large accent name below.
 * Gap 4 (LING-261): streak pill always visible, including when streak = 0
 *   ("0 ngày").
 */
import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {FlameModel, GreetingModel} from '../logic/homeScreenModel';
import {TimeOfDayBadge} from './HomeDecorations';
import {HomeIcon} from './HomeSvgIcons';

type Props = {
  greeting: GreetingModel;
  streak: number;
  flame: FlameModel;
};

export function HomeHeader({greeting, streak, flame}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // I5: greeting fade-in
  const greetingOpacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) {
      greetingOpacity.value = withTiming(1, {duration: 400});
    }
  }, [greetingOpacity, reducedMotion]);

  const greetingStyle = useAnimatedStyle(() => ({
    opacity: greetingOpacity.value,
  }));

  // I4: flame scale pulse — disabled under reduced motion
  const flameScale = useSharedValue(1);
  useEffect(() => {
    if (!reducedMotion && streak > 0) {
      flameScale.value = withTiming(1.15, {duration: 300});
    }
  }, [flameScale, reducedMotion, streak]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{scale: flameScale.value}],
  }));

  // Resolve accessible label for the full greeting
  const greetingA11y = greeting.a11yParams
    ? t(greeting.a11yKey, greeting.a11yParams)
    : t(greeting.a11yKey);

  // Small greeting prefix text (no name embedded)
  const greetingPrefixText = t(greeting.greetingKey);

  // Streak pill label — always show (Gap 4); "0 ngày" when streak = 0
  const streakA11yLabel = flame.a11yParams
    ? t(flame.a11yKey, flame.a11yParams)
    : t(flame.a11yKey);

  return (
    <View style={styles.header} testID="home-header">
      {/* Left: time-of-day badge */}
      <View style={styles.todBadge} testID="home-header-tod-badge">
        <TimeOfDayBadge timeOfDay={greeting.timeOfDay} />
      </View>

      {/* Center: greeting — single or two-line (Gap 3) */}
      <Animated.View
        style={[styles.greetingWrap, greetingStyle]}
        accessibilityLabel={greetingA11y}
      >
        {greeting.hasName && greeting.displayName ? (
          <>
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              testID="home-header-greeting-prefix"
            >
              {greetingPrefixText}
            </AppText>
            <AppText
              variant="h3"
              numberOfLines={1}
              testID="home-header-greeting"
            >
              {greeting.displayName}
            </AppText>
          </>
        ) : (
          <AppText
            variant="h3"
            numberOfLines={1}
            testID="home-header-greeting"
          >
            {greetingPrefixText}
          </AppText>
        )}
      </Animated.View>

      {/* Right: streak flame badge — always visible, including streak = 0 (Gap 4) */}
      <Animated.View
        style={[styles.flameBadge, flameStyle]}
        testID="home-header-flame"
        accessibilityLabel={streakA11yLabel}
        accessibilityRole="text"
      >
        <HomeIcon
          name="local_fire_department"
          size={20}
          color={flame.color}
          testID="home-flame-icon"
        />
        <AppText variant="label" style={{color: flame.color}}>
          {streak}
        </AppText>
      </Animated.View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 56,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    todBadge: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    greetingWrap: {
      flex: 1,
      minWidth: 0,
    },
    flameBadge: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      minHeight: 32,
    },
  });
}
