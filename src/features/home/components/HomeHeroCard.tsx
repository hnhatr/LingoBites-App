/**
 * HomeHeroCard — paper-cut hero card for the 5 Home states (DQ-002, P-004).
 *
 * Motion (AD-002):
 *   - I2 (cat bounce): disabled under reduced motion
 *   - I8 (CTA breathing pulse): disabled under reduced motion
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {HeroState} from '../logic/homeScreenModel';
import {
  HERO_BADGE_BG,
  HERO_BADGE_INK,
  HERO_BLUE,
  HERO_CTA_BG,
  HERO_CTA_INK,
  HERO_MINT,
  HERO_TITLE,
} from '../logic/homeScreenModel';
import {ConfettiParticles, HeartBurst, HeroBlobs, HomeWaveDecoration} from './HomeDecorations';
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
  /** Eyebrow label (kicker) i18n key — mockup v4 Gap 5 */
  eyebrowKey: string;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  bodyKey?: string;
  ctaKey: string;
  ctaParams?: Record<string, string | number>;
  ctaA11yKey?: string;
  /** Icon name for the CTA button — mockup v4 Gap 5 */
  ctaIconName: HomeSvgIconName;
};

function getStateContent(
  heroState: HeroState,
  startedLessonTitle: string | undefined,
  startedLessonMinutes: number | undefined,
  displayName: string | null,
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
        titleParams: libraryCount != null ? {n: libraryCount} : undefined,
        bodyKey: 'home.hero_saved_body',
        ctaKey: 'home.hero_saved_cta',
        ctaIconName: 'menu_book',
      };
    case 'in_progress':
      return {
        eyebrowKey: 'home.hero_eyebrow_in_progress',
        titleKey: startedLessonTitle
          ? 'home.hero_in_progress_title'
          : 'home.hero_in_progress_title',
        bodyKey: undefined, // A-009: no progress bar
        ctaKey: 'home.hero_in_progress_cta',
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
  streak,
  displayName,
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

  // I2: cat bounce on tap — disabled under reduced motion
  const mascotScale = useSharedValue(1);

  const handleMascotTap = useCallback(() => {
    if (reducedMotion) return;
    mascotScale.value = withSequence(
      withTiming(1.2, {duration: 150}),
      withTiming(1.0, {duration: 200}),
    );
    setShowHearts(true);
    if (heartTimerRef.current) {
      clearTimeout(heartTimerRef.current);
    }
    heartTimerRef.current = setTimeout(() => setShowHearts(false), 800);
  }, [mascotScale, reducedMotion]);

  useEffect(() => {
    return () => {
      if (heartTimerRef.current) {
        clearTimeout(heartTimerRef.current);
      }
    };
  }, []);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{scale: mascotScale.value}],
  }));

  // I8: CTA breathing pulse — disabled under reduced motion
  const ctaScale = useSharedValue(1);
  useEffect(() => {
    if (!reducedMotion) {
      ctaScale.value = withSequence(
        withTiming(1.04, {duration: 1000}),
        withTiming(1.0, {duration: 1000}),
      );
    }
  }, [ctaScale, reducedMotion]);

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{scale: ctaScale.value}],
  }));

  const content = getStateContent(
    heroState,
    startedLessonTitle,
    startedLessonMinutes,
    displayName,
    libraryCount,
  );
  const eyebrowText = t(content.eyebrowKey);
  const titleText = content.titleParams
    ? t(content.titleKey, content.titleParams)
    : t(content.titleKey);
  const bodyText = content.bodyKey ? t(content.bodyKey) : null;
  const ctaText = content.ctaParams
    ? t(content.ctaKey, content.ctaParams)
    : t(content.ctaKey);
  const speechText = t(getMascotSpeech(heroState));

  const isGoalMet = heroState === 'goal_met';

  return (
    <View
      style={styles.card}
      testID={testID ?? `home-hero-${heroState}`}
      accessibilityRole="none"
    >
      <HeroBlobs />
      {/* Paper-cut wave decoration at bottom of hero (Gap 5) */}
      <HomeWaveDecoration
        color={HERO_MINT}
        secondaryColor="#3d88c4"
        width={400}
        height={60}
        testID="home-hero-waves"
      />
      {isGoalMet && <ConfettiParticles visible={!reducedMotion} />}

      {/* Text content */}
      <View style={styles.copy} testID="home-hero-copy">
        {/* Eyebrow / kicker label — mockup v4 Gap 5 */}
        <AppText
          variant="caption"
          style={styles.eyebrow}
          testID="home-hero-eyebrow"
          numberOfLines={1}
        >
          {eyebrowText}
        </AppText>

        {streak > 0 && heroState === 'in_progress' ? (
          <View style={styles.badge}>
            <AppText variant="label" style={styles.badgeLabel}>
              {t('home.hero_streak', {count: streak})}
            </AppText>
          </View>
        ) : null}

        <AppText variant="h3" style={styles.title} numberOfLines={2}>
          {titleText}
        </AppText>

        {bodyText ? (
          <AppText variant="caption" style={styles.body}>
            {bodyText}
          </AppText>
        ) : null}

        <Animated.View style={ctaStyle}>
          <Pressable
            accessibilityLabel={ctaText}
            accessibilityRole="button"
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
            style={({pressed}) => [
              styles.cta,
              pressed && {opacity: theme.states.pressedOpacity},
            ]}
          >
            {/* CTA icon — mockup v4 Gap 5 */}
            <HomeIcon
              name={content.ctaIconName}
              size={18}
              color={HERO_CTA_INK}
              testID="home-hero-cta-icon"
            />
            <AppText variant="label" style={styles.ctaLabel}>
              {ctaText}
            </AppText>
          </Pressable>
        </Animated.View>
      </View>

      {/* Mascot with tap interaction (I2) + speech bubble overlay (Gap 5) */}
      <View style={styles.mascotWrap}>
        {/* Speech bubble positioned above cat — mockup v4 Gap 5 */}
        <View style={styles.bubble} testID="home-mascot-bubble">
          <AppText
            variant="caption"
            style={styles.bubbleText}
            numberOfLines={2}
          >
            {speechText}
          </AppText>
        </View>
        <HeartBurst visible={showHearts} />
        <Pressable
          onPress={handleMascotTap}
          accessibilityLabel={t('home.mascot_in_progress')}
          accessibilityRole="image"
          testID="home-hero-mascot-btn"
          style={styles.mascotTapTarget}
        >
          <Animated.View style={mascotStyle}>
            <Image
              source={require('@ui/assets/home-hero-cat.png')}
              style={styles.mascotImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: HERO_BLUE,
      borderRadius: theme.radius.xl,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 250,
      overflow: 'hidden',
      padding: theme.spacing.lg,
      ...theme.shadow.soft,
    },
    copy: {flex: 1, gap: theme.spacing.sm, minWidth: 0},
    eyebrow: {
      color: HERO_TITLE,
      fontWeight: '800',
      letterSpacing: 0.6,
      opacity: 0.9,
      textTransform: 'uppercase',
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: HERO_BADGE_BG,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
    },
    badgeLabel: {color: HERO_BADGE_INK},
    title: {color: HERO_TITLE},
    body: {color: HERO_TITLE, opacity: 0.92},
    cta: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: HERO_CTA_BG,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
      minHeight: 48,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    ctaLabel: {color: HERO_CTA_INK, textAlign: 'center'},
    mascotWrap: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: -110,
      marginRight: -18,
      minHeight: 48,
      minWidth: 48,
      position: 'relative',
      width: 128,
    },
    mascotTapTarget: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      minHeight: 48,
      minWidth: 48,
      width: 128,
    },
    mascotImage: {height: 140, width: 112},
    bubble: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.overlayLight,
      borderRadius: theme.radius.md,
      maxWidth: '90%',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 2,
    },
    bubbleText: {color: HERO_TITLE, opacity: 0.9},
  });
}
