/**
 * HomeHeader — greeting with the cat and the streak flame (LING-256, §VS-1).
 *
 * Layout: [cat 52] gap 12 [text column, minWidth 0] ... [streak pill]
 * The cat says the state's line to screen readers; a tap makes it wiggle
 * and pop hearts (off under Reduced motion).
 *
 * Motion (§VS-7):
 *   - I4 (flame flicker loop): duration (2.2 - 0.18*lv)s, rotate ±(1.6*lv)°, scale (1 ± 0.02*lv); off under RM
 *   - I5 (greeting fade-in): static under RM
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, StyleSheet, View} from 'react-native';
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
import {getStickerEdge, HeartBurst} from './HomeDecorations';
import {HomeIcon} from './HomeSvgIcons';

const PALETTE = {
  catBg: '#fff3c4',
  ember1: '#ffb03a',
  ember2: '#ff6a1a',
  flameGlow: 'rgba(255,110,0,0.75)',
};

type Props = {
  greeting: GreetingModel;
  streak: number;
  flame: FlameModel;
  /** What the cat says, read out by screen readers. */
  mascotLabel: string;
};

export function HomeHeader({greeting, streak, flame, mascotLabel}: Props) {
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

  // Cat tap: a quick wiggle and a burst of hearts
  const catRotate = useSharedValue(0);
  const [showHearts, setShowHearts] = useState(false);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCatTap = useCallback(() => {
    if (reducedMotion) return;
    catRotate.value = withSequence(
      withTiming(-8, {duration: 120}),
      withTiming(8, {duration: 120}),
      withTiming(0, {duration: 160}),
    );
    setShowHearts(true);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    heartTimerRef.current = setTimeout(() => setShowHearts(false), 1100);
  }, [catRotate, reducedMotion]);
  useEffect(
    () => () => {
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    },
    [],
  );
  const catAnimStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${catRotate.value}deg`}],
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
      {/* Left: the cat, in a soft sun tile */}
      <View style={styles.catWrap}>
        <Pressable
          accessibilityLabel={mascotLabel}
          accessibilityRole="image"
          hitSlop={6}
          onPress={handleCatTap}
          testID="home-hero-mascot-btn"
        >
          <Animated.View style={[styles.catTile, catAnimStyle]}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={require('@ui/assets/home-hero-cat.png')}
              style={styles.catImage}
            />
          </Animated.View>
        </Pressable>
        <View pointerEvents="none" style={styles.hearts}>
          <HeartBurst visible={showHearts} />
        </View>
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
      gap: 12,
      paddingTop: 6,
      paddingBottom: 14,
    },
    catWrap: {
      position: 'relative',
    },
    catTile: {
      backgroundColor: PALETTE.catBg,
      borderRadius: 18,
      height: 52,
      overflow: 'hidden',
      width: 52,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    catImage: {
      height: 72,
      left: -4,
      position: 'absolute',
      top: 2,
      width: 60,
    },
    hearts: {
      height: 52,
      left: 0,
      position: 'absolute',
      top: 0,
      width: 52,
    },
    greetingWrap: {
      flex: 1,
      minWidth: 0,
    },
    helloPrefix: {
      color: theme.colors.text.muted,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '600',
    },
    nameContainer: {
      alignSelf: 'flex-start',
      marginTop: 1,
      position: 'relative',
    },
    nameText: {
      color: theme.colors.text.primary,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    singleGreetingText: {
      color: theme.colors.text.primary,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    streakPill: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 4,
      height: 40,
      paddingBottom: 6,
      paddingLeft: 8,
      paddingRight: 12,
      paddingTop: 6,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
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
      color: theme.colors.text.primary,
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
