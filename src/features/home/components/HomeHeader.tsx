/**
 * HomeHeader — time-of-day greeting with streak flame badge.
 * No app brand name (DQ-008, D7). Covers I4, I5, P-001.
 *
 * Motion (AD-002):
 *   - I4 (flame wiggle): disabled under reduced motion
 *   - I5 (greeting fade-in): static under reduced motion
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

  // Resolve greeting text
  const greetingText = greeting.greetingParams
    ? t(greeting.greetingKey, greeting.greetingParams)
    : t(greeting.greetingKey);

  return (
    <View style={styles.header} testID="home-header">
      {/* Left: time-of-day badge */}
      <View style={styles.todBadge} testID="home-header-tod-badge">
        <TimeOfDayBadge timeOfDay={greeting.timeOfDay} />
      </View>

      {/* Center: greeting */}
      <Animated.View style={[styles.greetingWrap, greetingStyle]}>
        <AppText
          variant="h3"
          numberOfLines={1}
          testID="home-header-greeting"
          accessibilityLabel={greetingText}
        >
          {greetingText}
        </AppText>
      </Animated.View>

      {/* Right: streak flame badge */}
      {streak > 0 ? (
        <Animated.View
          style={[styles.flameBadge, flameStyle]}
          testID="home-header-flame"
          accessibilityLabel={
            flame.a11yParams
              ? t(flame.a11yKey, flame.a11yParams)
              : t(flame.a11yKey)
          }
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
      ) : null}
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
