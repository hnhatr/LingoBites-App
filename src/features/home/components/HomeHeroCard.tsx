/**
 * HomeHeroCard — paper-cut hero card for the 5 Home states (LING-256, LING-267, §VS-2).
 *
 * Motion (§VS-7):
 *   - I1 (bubble pop-in): scale 0 -> 1 with overshoot, 400ms, delay 500ms; static under RM
 *   - I2 (cat bob loop): 3s loop translateY -5, rotate -2°; tap: squash + 4 hearts; off under RM
 *   - I8 (CTA breathe loop): 2.4s halo pulse 0 to 6pt around CTA; off under RM
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {HeroState} from '../logic/homeScreenModel';
import {
  HERO_BLUE,
  HERO_CORAL,
  HERO_CTA_BG,
  HERO_CTA_INK,
  HERO_TITLE,
} from '../logic/homeScreenModel';
import {
  getHardShadow,
  HeartBurst,
  HomeHeroSparks,
  HomeHeroWaves,
} from './HomeDecorations';
import {HomeIcon, type HomeSvgIconName} from './HomeSvgIcons';

type Props = {
  heroState: HeroState;
  streak: number;
  displayName: string | null;
  startedLessonTitle?: string;
  startedLessonMinutes?: number;
  libraryCount?: number | null;
  onPrimary: () => void;
  testID?: string;
};

type StateContent = {
  eyebrowKey: string;
  titleKey?: string;
  explicitTitle?: string;
  titleParams?: Record<string, string | number>;
  bodyKey?: string;
  bodyParams?: Record<string, string | number>;
  ctaKey?: string;
  explicitCta?: string;
  ctaParams?: Record<string, string | number>;
  ctaIconName: HomeSvgIconName;
};

function getStateContent(
  heroState: HeroState,
  startedLessonTitle: string | undefined,
  startedLessonMinutes: number | undefined,
  libraryCount: number | null | undefined,
): StateContent {
  switch (heroState) {
    case 'no_lessons':
      return {
        eyebrowKey: 'home.hero_eyebrow_no_lessons',
        titleKey: 'home.hero_no_lessons_title',
        bodyKey: 'home.hero_no_lessons_body',
        ctaKey: 'home.hero_no_lessons_cta',
        ctaIconName: 'auto_awesome',
      };
    case 'saved_only':
      return {
        eyebrowKey: 'home.hero_eyebrow_saved',
        titleKey: 'home.hero_saved_title',
        bodyKey:
          libraryCount === 1
            ? 'home.hero_saved_body_one'
            : 'home.hero_saved_body_other',
        bodyParams: {count: libraryCount ?? 0},
        ctaKey: 'home.hero_saved_cta',
        ctaIconName: 'menu_book',
      };
    case 'in_progress':
      return {
        eyebrowKey: 'home.hero_eyebrow_in_progress',
        explicitTitle: startedLessonTitle,
        titleKey: startedLessonTitle
          ? undefined
          : 'home.hero_in_progress_title',
        bodyKey:
          startedLessonMinutes != null
            ? 'home.hero_in_progress_body'
            : undefined,
        bodyParams:
          startedLessonMinutes != null
            ? {minutes: startedLessonMinutes}
            : undefined,
        ctaKey:
          startedLessonMinutes != null
            ? 'home.hero_continue_cta'
            : 'home.hero_in_progress_cta',
        ctaParams:
          startedLessonMinutes != null
            ? {minutes: startedLessonMinutes}
            : undefined,
        ctaIconName: 'play_arrow',
      };
    case 'goal_met':
      return {
        eyebrowKey: 'home.hero_eyebrow_goal_met',
        titleKey: 'home.hero_goal_met_title',
        bodyKey: 'home.hero_goal_met_body',
        ctaKey: 'home.hero_goal_met_cta',
        ctaIconName: 'menu_book',
      };
    case 'youtube_disabled':
      return {
        eyebrowKey: 'home.hero_eyebrow_youtube_disabled',
        titleKey: 'home.hero_youtube_disabled_title',
        bodyKey: 'home.hero_youtube_disabled_body',
        ctaKey: 'home.hero_youtube_disabled_cta',
        ctaIconName: 'menu_book',
      };
  }
}

function getMascotSpeech(heroState: HeroState): string {
  const keyMap: Record<HeroState, string> = {
    no_lessons: 'home.mascot_no_lessons',
    saved_only: 'home.mascot_saved',
    in_progress: 'home.mascot_in_progress',
    goal_met: 'home.mascot_goal_met',
    youtube_disabled: 'home.mascot_youtube_disabled',
  };
  return keyMap[heroState];
}

export function HomeHeroCard({
  heroState,
  startedLessonTitle,
  startedLessonMinutes,
  libraryCount,
  onPrimary,
  testID,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [showHearts, setShowHearts] = useState(false);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // I1: Bubble pop-in animation (§VS-7)
  const bubbleScale = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) {
      bubbleScale.value = withDelay(
        500,
        withTiming(1, {duration: 400, easing: Easing.out(Easing.quad)}),
      );
    } else {
      bubbleScale.value = 1;
    }
  }, [bubbleScale, reducedMotion]);

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{scale: bubbleScale.value}],
  }));

  // I2: Cat bobbing loop (§VS-7: 3s ease-in-out loop translateY -5, rotate -2°)
  const catBobY = useSharedValue(0);
  const catBobRotate = useSharedValue(0);
  const catSquashScaleX = useSharedValue(1);
  const catSquashScaleY = useSharedValue(1);
  const catSquashRotate = useSharedValue(0);

  useEffect(() => {
    if (!reducedMotion) {
      catBobY.value = withRepeat(
        withSequence(
          withTiming(-5, {duration: 1500, easing: Easing.inOut(Easing.quad)}),
          withTiming(0, {duration: 1500, easing: Easing.inOut(Easing.quad)}),
        ),
        -1,
        false,
      );
      catBobRotate.value = withRepeat(
        withSequence(
          withTiming(-2, {duration: 1500, easing: Easing.inOut(Easing.quad)}),
          withTiming(0, {duration: 1500, easing: Easing.inOut(Easing.quad)}),
        ),
        -1,
        false,
      );
    } else {
      catBobY.value = 0;
      catBobRotate.value = 0;
    }
  }, [catBobRotate, catBobY, reducedMotion]);

  const handleMascotTap = useCallback(() => {
    if (reducedMotion) return;
    // Squash: 30% scale 1.08x0.9; 60% 0.95x1.08, rotate 3°
    catSquashScaleX.value = withSequence(
      withTiming(1.08, {duration: 150}),
      withTiming(0.95, {duration: 150}),
      withTiming(1.0, {duration: 200}),
    );
    catSquashScaleY.value = withSequence(
      withTiming(0.9, {duration: 150}),
      withTiming(1.08, {duration: 150}),
      withTiming(1.0, {duration: 200}),
    );
    catSquashRotate.value = withSequence(
      withTiming(0, {duration: 150}),
      withTiming(3, {duration: 150}),
      withTiming(0, {duration: 200}),
    );
    setShowHearts(true);
    if (heartTimerRef.current) {
      clearTimeout(heartTimerRef.current);
    }
    heartTimerRef.current = setTimeout(() => setShowHearts(false), 1100);
  }, [catSquashRotate, catSquashScaleX, catSquashScaleY, reducedMotion]);

  useEffect(() => {
    return () => {
      if (heartTimerRef.current) {
        clearTimeout(heartTimerRef.current);
      }
    };
  }, []);

  const catAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: catBobY.value},
      {rotate: `${catBobRotate.value + catSquashRotate.value}deg`},
      {scaleX: catSquashScaleX.value},
      {scaleY: catSquashScaleY.value},
    ],
  }));

  // I8: CTA breathe loop (§VS-7: 2.4s halo pulse 0 to 6pt around CTA)
  const ctaHalo = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) {
      ctaHalo.value = withRepeat(
        withSequence(
          withTiming(6, {duration: 1200, easing: Easing.inOut(Easing.quad)}),
          withTiming(0, {duration: 1200, easing: Easing.inOut(Easing.quad)}),
        ),
        -1,
        false,
      );
    } else {
      ctaHalo.value = 0;
    }
  }, [ctaHalo, reducedMotion]);

  const ctaHaloStyle = useAnimatedStyle(() => ({
    top: -ctaHalo.value,
    bottom: -ctaHalo.value,
    left: -ctaHalo.value,
    right: -ctaHalo.value,
    opacity: ctaHalo.value > 0 ? 0.33 : 0,
  }));

  const content = getStateContent(
    heroState,
    startedLessonTitle,
    startedLessonMinutes,
    libraryCount,
  );
  const eyebrowText = t(content.eyebrowKey);
  const titleText = content.explicitTitle
    ? content.explicitTitle
    : content.titleKey
    ? content.titleParams
      ? t(content.titleKey, content.titleParams)
      : t(content.titleKey)
    : '';
  const bodyText = content.bodyKey
    ? content.bodyParams
      ? t(content.bodyKey, content.bodyParams)
      : t(content.bodyKey)
    : null;
  const ctaText = content.explicitCta
    ? content.explicitCta
    : content.ctaKey
    ? content.ctaParams
      ? t(content.ctaKey, content.ctaParams)
      : t(content.ctaKey)
    : '';
  const speechText = t(getMascotSpeech(heroState));

  return (
    <View
      style={styles.card}
      testID={testID ?? `home-hero-${heroState}`}
      accessibilityRole="none"
    >
      {/* §VS-2.2 Decorations in paint order */}
      {/* 1. Coral circle 140 at right -40, top -50 */}
      <View style={styles.coralBlob} />

      {/* 2. Paper sheet 118x150 rotated -6° at right 18, bottom -6 */}
      <View style={styles.paperSheet} />

      {/* 3. Waves SVG (back #3d88c4, front #6BD2AD) */}
      <HomeHeroWaves />

      {/* 4. Sparks (white opacity 0.85) */}
      <HomeHeroSparks />

      {/* Foreground (§VS-2.3): column text layout with paddingRight 138 */}
      <View style={styles.textColumn} testID="home-hero-copy">
        {/* Kicker: 12pt weight 800 uppercase */}
        <AppText
          style={styles.kicker}
          testID="home-hero-eyebrow"
          numberOfLines={1}
        >
          {eyebrowText}
        </AppText>

        {/* Title: 20/25 weight 700, max 3 lines (EC-003) */}
        <AppText style={styles.title} numberOfLines={3}>
          {titleText}
        </AppText>

        {/* Body: 13pt weight 500 opacity 0.95 */}
        {bodyText ? (
          <AppText style={styles.body} numberOfLines={2}>
            {bodyText}
          </AppText>
        ) : null}

        {/* CTA button with halo and icon */}
        <View style={styles.ctaWrapper}>
          <Animated.View style={[styles.ctaHalo, ctaHaloStyle]} />
          <Pressable
            accessibilityLabel={ctaText}
            accessibilityRole="button"
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={onPrimary}
            testID={
              heroState === 'in_progress'
                ? 'home-continue-action'
                : heroState === 'saved_only'
                ? 'home-starter-pick'
                : heroState === 'no_lessons'
                ? 'home-starter-first'
                : 'home-hero-cta'
            }
            style={({pressed}) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <HomeIcon
              name={content.ctaIconName}
              size={20}
              color={HERO_CTA_INK}
              testID="home-hero-cta-icon"
            />
            <AppText style={styles.ctaLabel} numberOfLines={1}>
              {ctaText}
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* Cat image & tap target (absolute at right 6, bottom -14) */}
      <View style={styles.catContainer}>
        <HeartBurst visible={showHearts} />
        <Pressable
          onPress={handleMascotTap}
          accessibilityLabel={speechText}
          accessibilityRole="image"
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          testID="home-hero-mascot-btn"
          style={styles.catTapTarget}
        >
          <Animated.View style={catAnimStyle}>
            <Image
              source={require('@ui/assets/home-hero-cat.png')}
              style={styles.catImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </Pressable>
      </View>

      {/* Speech bubble: absolute at right 58, top 8, width 120, white bg, border 2 ink */}
      <Animated.View
        style={[styles.bubble, bubbleAnimStyle]}
        testID="home-mascot-bubble"
      >
        <AppText style={styles.bubbleText}>{speechText}</AppText>
        {/* Downward tail: outer ink triangle + inner white triangle */}
        <View style={styles.bubbleTailOuter} testID="home-mascot-bubble-tail" />
        <View style={styles.bubbleTailInner} />
      </Animated.View>
    </View>
  );
}

const CARD_PALETTE = {
  paperSheet: '#ffffff22',
  haloBg: '#ffd35e',
  bubbleBg: '#ffffff',
  bubbleTailInner: '#ffffff',
  bubbleText: '#1c1c10',
};

const TRANSPARENT = 'rgba(0,0,0,0)';

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: HERO_BLUE,
      borderColor: theme.colors.ink,
      borderRadius: 24,
      borderWidth: 2,
      minHeight: 190,
      overflow: 'hidden',
      paddingBottom: 20,
      paddingLeft: 20,
      paddingRight: 138,
      paddingTop: 20,
      position: 'relative',
      ...getHardShadow(6, theme.colors.ink),
    },
    coralBlob: {
      backgroundColor: HERO_CORAL,
      borderRadius: 70,
      height: 140,
      position: 'absolute',
      right: -40,
      top: -50,
      width: 140,
    },
    paperSheet: {
      backgroundColor: CARD_PALETTE.paperSheet,
      borderRadius: 18,
      bottom: -6,
      height: 150,
      position: 'absolute',
      right: 18,
      transform: [{rotate: '-6deg'}],
      width: 118,
    },
    textColumn: {
      flex: 1,
      minWidth: 0,
      zIndex: 1,
    },
    kicker: {
      color: HERO_TITLE,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      marginTop: 34,
      opacity: 0.9,
      textTransform: 'uppercase',
    },
    title: {
      color: HERO_TITLE,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 25,
      marginBottom: 4,
      marginTop: 6,
    },
    body: {
      color: HERO_TITLE,
      fontSize: 13,
      fontWeight: '500',
      marginBottom: 14,
      opacity: 0.95,
    },
    ctaWrapper: {
      alignSelf: 'flex-start',
      marginTop: 4,
      position: 'relative',
    },
    ctaHalo: {
      backgroundColor: CARD_PALETTE.haloBg,
      borderRadius: 999,
      position: 'absolute',
    },
    cta: {
      alignItems: 'center',
      backgroundColor: HERO_CTA_BG,
      borderColor: theme.colors.ink,
      borderRadius: 999,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 44,
      paddingLeft: 14,
      paddingRight: 18,
      paddingVertical: 10,
      ...getHardShadow(4, theme.colors.ink),
    },
    ctaPressed: {
      transform: [{translateY: 3}],
      ...getHardShadow(1, theme.colors.ink),
    },
    ctaLabel: {
      color: HERO_CTA_INK,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    catContainer: {
      bottom: -14,
      position: 'absolute',
      right: 6,
      width: 126,
      zIndex: 2,
    },
    catTapTarget: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      minHeight: 48,
      minWidth: 48,
      width: 126,
    },
    catImage: {
      height: 157,
      width: 126,
    },
    bubble: {
      backgroundColor: CARD_PALETTE.bubbleBg,
      borderColor: theme.colors.ink,
      borderRadius: 14,
      borderWidth: 2,
      maxWidth: 120,
      paddingHorizontal: 9,
      paddingVertical: 6,
      position: 'absolute',
      right: 58,
      top: 8,
      width: 120,
      zIndex: 3,
    },
    bubbleText: {
      color: CARD_PALETTE.bubbleText,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
    },
    bubbleTailOuter: {
      borderLeftColor: TRANSPARENT,
      borderLeftWidth: 6,
      borderRightColor: TRANSPARENT,
      borderRightWidth: 6,
      borderTopColor: theme.colors.ink,
      borderTopWidth: 12,
      bottom: -12,
      height: 0,
      position: 'absolute',
      right: 16,
      width: 0,
    },
    bubbleTailInner: {
      borderLeftColor: TRANSPARENT,
      borderLeftWidth: 4,
      borderRightColor: TRANSPARENT,
      borderRightWidth: 4,
      borderTopColor: CARD_PALETTE.bubbleTailInner,
      borderTopWidth: 9,
      bottom: -8,
      height: 0,
      position: 'absolute',
      right: 18,
      width: 0,
    },
  });
}
