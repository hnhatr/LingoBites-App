/**
 * HomeHeader — time-of-day greeting with streak flame badge (LING-256, LING-267, §VS-1).
 *
 * Layout: [TOD badge 46] gap 10 [text column, minWidth 0] ... [streak pill]
 *
 * Motion (§VS-7):
 *   - I4 (flame flicker loop): duration (2.2 - 0.18*lv)s, rotate ±(1.6*lv)°, scale (1 ± 0.02*lv); off under RM
 *   - I5 (greeting fade-in): static under RM
 */
import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {FlameModel, GreetingModel} from '../logic/homeScreenModel';
import {getHardShadow, TimeOfDayBadge} from './HomeDecorations';
import {HomeIcon} from './HomeSvgIcons';

const PALETTE = {
  highlight: '#FFD35E',
  borderInk: '#1c1c10',
  ember1: '#ffb03a',
  ember2: '#ff6a1a',
  streakNumber: '#1c1c10',
  flameGlow: 'rgba(255,110,0,0.75)',
};

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
    } else {
      greetingOpacity.value = 1;
    }
  }, [greetingOpacity, reducedMotion]);

  const greetingStyle = useAnimatedStyle(() => ({
    opacity: greetingOpacity.value,
  }));

  // I4: flame flicker loop (§VS-7)
  const lv = flame.level;
  const flameRotate = useSharedValue(0);
  const flameScale = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion && lv > 0) {
      const duration = (2.2 - 0.18 * lv) * 1000;
      const amp = lv * 1.6;
      const scaleDelta = lv * 0.02;

      flameRotate.value = withRepeat(
        withSequence(
          withTiming(-amp, {
            duration: duration * 0.25,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {duration: duration * 0.25}),
          withTiming(amp, {
            duration: duration * 0.25,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {duration: duration * 0.25}),
        ),
        -1,
        false,
      );

      flameScale.value = withRepeat(
        withSequence(
          withTiming(1 + scaleDelta, {duration: duration * 0.25}),
          withTiming(1, {duration: duration * 0.25}),
          withTiming(1 - scaleDelta, {duration: duration * 0.25}),
          withTiming(1, {duration: duration * 0.25}),
        ),
        -1,
        false,
      );
    } else {
      flameRotate.value = 0;
      flameScale.value = 1;
    }
  }, [flameRotate, flameScale, lv, reducedMotion]);

  const flameAnimStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${flameRotate.value}deg`}, {scale: flameScale.value}],
  }));

  // Resolve accessible labels
  const greetingA11y = greeting.a11yParams
    ? t(greeting.a11yKey, greeting.a11yParams)
    : t(greeting.a11yKey);

  const greetingPrefixText = t(greeting.prefixKey);
  const fallbackGreetingText = t(greeting.greetingKey);

  // Unit string
  const unitText =
    streak === 1 ? t('home.streak_unit_one') : t('home.streak_unit_other');

  const streakA11yLabel = flame.a11yParams
    ? t(flame.a11yKey, flame.a11yParams)
    : t(flame.a11yKey);

  return (
    <View style={styles.header} testID="home-header">
      {/* Left: 46pt Time-of-day badge (§VS-1.1) */}
      <View style={styles.todBadge} testID="home-header-tod-badge">
        <TimeOfDayBadge timeOfDay={greeting.timeOfDay} />
      </View>

      {/* Center: Greeting text column (§VS-1.1) */}
      <Animated.View
        style={[styles.greetingWrap, greetingStyle]}
        accessibilityLabel={greetingA11y}
      >
        {greeting.hasName && greeting.displayName ? (
          <>
            <AppText
              style={styles.helloPrefix}
              numberOfLines={1}
              testID="home-header-greeting-prefix"
            >
              {greetingPrefixText}
            </AppText>
            <View style={styles.nameContainer}>
              <View style={styles.nameHighlightBar} />
              <AppText
                style={styles.nameText}
                numberOfLines={1}
                testID="home-header-greeting"
              >
                {greeting.displayName}
              </AppText>
            </View>
          </>
        ) : (
          <AppText
            style={styles.singleGreetingText}
            numberOfLines={1}
            testID="home-header-greeting"
          >
            {fallbackGreetingText}
          </AppText>
        )}
      </Animated.View>

      {/* Right: Streak pill (§VS-1.2) */}
      <View
        style={styles.streakPill}
        testID="home-header-flame"
        accessibilityLabel={streakA11yLabel}
        accessibilityRole="text"
      >
        <View
          style={[
            styles.flameContainer,
            lv >= 3 && {
              shadowColor: PALETTE.flameGlow,
              shadowOffset: {width: 0, height: 0},
              shadowOpacity: 0.75,
              shadowRadius: flame.glowRadius,
            },
          ]}
        >
          <Animated.View style={flameAnimStyle}>
            <HomeIcon
              name="local_fire_department"
              size={flame.size}
              color={flame.color}
              testID="home-flame-icon"
            />
          </Animated.View>
          {/* Embers for level >= 7 (§VS-1.3) */}
          {flame.hasEmbers ? (
            <>
              <View style={styles.ember1} />
              <View style={styles.ember2} />
            </>
          ) : null}
        </View>

        <AppText style={styles.streakNumber}>{streak}</AppText>
        <AppText style={styles.streakUnit}>&nbsp;{unitText}</AppText>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingTop: 10,
      paddingBottom: 14,
      paddingHorizontal: 16,
    },
    todBadge: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    greetingWrap: {
      flex: 1,
      minWidth: 0,
    },
    helloPrefix: {
      color: theme.colors.text.secondary,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '600',
    },
    nameContainer: {
      alignSelf: 'flex-start',
      marginTop: 1,
      position: 'relative',
    },
    nameHighlightBar: {
      backgroundColor: PALETTE.highlight,
      borderRadius: 6,
      bottom: 3,
      height: 9,
      left: -2,
      position: 'absolute',
      right: -4,
      transform: [{rotate: '-1.5deg'}],
      zIndex: -1,
    },
    nameText: {
      color: theme.colors.primary,
      fontSize: 28,
      lineHeight: 32,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    singleGreetingText: {
      color: theme.colors.primary,
      fontSize: 28,
      lineHeight: 32,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    streakPill: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: PALETTE.borderInk,
      borderRadius: 999,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 4,
      height: 42,
      paddingBottom: 6,
      paddingLeft: 8,
      paddingRight: 12,
      paddingTop: 6,
      ...getHardShadow(3),
    },
    flameContainer: {
      alignItems: 'center',
      height: 24,
      justifyContent: 'center',
      position: 'relative',
      width: 24,
    },
    ember1: {
      backgroundColor: PALETTE.ember1,
      borderRadius: 2,
      bottom: 22,
      height: 4,
      left: 18,
      position: 'absolute',
      width: 4,
    },
    ember2: {
      backgroundColor: PALETTE.ember2,
      borderRadius: 2,
      bottom: 22,
      height: 4,
      left: 24,
      position: 'absolute',
      width: 4,
    },
    streakNumber: {
      color: PALETTE.streakNumber,
      fontSize: 16,
      fontWeight: '900',
    },
    streakUnit: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
