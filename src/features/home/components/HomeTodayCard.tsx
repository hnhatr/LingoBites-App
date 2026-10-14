/**
 * HomeTodayCard — the bright "Hôm nay" card at the top of Home.
 *
 * A mint-to-sky gradient card with a picture fading in on the right:
 *   [Còn 2 việc · khoảng 18 phút ›            🎯 20 phút ▾]
 *   Bước 2/3 · ~8 phút                          [picture]
 *   Bài học mới: Chọn chỗ ngồi
 *   [A1 – Du lịch cơ bản ›]                           (▶)
 *   [ ✓ Ôn thẻ ┄┄ ② Bài mới ┄┄ ③ Luyện nói ┄┄ +1 🐾 ]   white strip
 *
 * The picture is the lesson's cover, else the level's cover, else the cat.
 * The main row follows the six hero states; the route shows today's plan
 * steps (each opens its activity) and the "+1 🐾" tag while the step
 * finishes a lesson that counts this week. The summary chip opens the full
 * Today screen; the mode chip opens the 5/20/45-minute choices in place.
 */
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import Svg, {
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Mask,
  Rect,
  Stop,
} from 'react-native-svg';

import type {StudyActivityItem, TodayMode} from '@features/today';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {HeroState} from '../logic/homeScreenModel';
import type {TodayProgressModel} from '../logic/todayProgress';
import {HomeIcon, type HomeSvgIconName} from './HomeSvgIcons';

/** The card keeps its own colours in every theme, as the hero card did. */
const PALETTE = {
  faceFrom: '#34dcc3',
  faceTo: '#5fc8ff',
  shelf: '#1fa597',
  ink: '#1c1c10',
  tealInk: '#00413a',
  teal: '#006b5f',
  white: '#ffffff',
  chip: 'rgba(255,255,255,0.85)',
  chipStrong: 'rgba(255,255,255,0.92)',
  strip: 'rgba(255,255,255,0.85)',
  dash: 'rgba(0,0,0,0.18)',
  coral: '#fe7488',
  coralShelf: '#e2506a',
  coralRing: 'rgba(254,116,136,0.25)',
  sun: '#ffd166',
  sunShelf: '#e0a92e',
};

const CAT = require('@ui/assets/home-hero-cat.png');
const ART_HEIGHT = 150;

const MODE_OPTIONS: ReadonlyArray<{
  mode: TodayMode;
  labelKey: string;
  minutes: number;
}> = [
  {mode: '5-minute', labelKey: 'home.today_mode_5', minutes: 5},
  {mode: 'normal', labelKey: 'home.today_mode_20', minutes: 20},
  {mode: 'deep-practice', labelKey: 'home.today_mode_45', minutes: 45},
];

export type HomeTodayStep = {
  title: string;
  minutes: number;
  /** 1-based position of the step in today's plan. */
  step: number;
  total: number;
  type: StudyActivityItem['type'];
};

type Props = {
  heroState: HeroState;
  /** Today's next plan step, shown in the `next_activity` state. */
  nextStep?: HomeTodayStep | null;
  startedLessonTitle?: string;
  startedLessonMinutes?: number;
  libraryCount?: number | null;
  /** Cover of the lesson the main row points at, when it has one. */
  coverUrl?: string | null;
  /** True while the main row's step finishes a lesson that counts this week. */
  showPawReward?: boolean;
  /** Level chosen at onboarding, shown as a pill; hidden when null. */
  pathTitle?: string | null;
  onOpenPath?: () => void;
  onPrimary: () => void;
  mode: TodayMode;
  progress: TodayProgressModel | null;
  onModeChange: (mode: TodayMode) => void;
  onViewDetails: () => void;
  onStartActivity: (activity: StudyActivityItem) => void;
};

type MainContent = {
  eyebrow: string;
  title: string;
  body: string | null;
  cta: string;
  /** Round play button instead of a labelled pill. */
  play: boolean;
  ctaIcon: HomeSvgIconName;
};

export function HomeTodayCard({
  heroState,
  nextStep,
  startedLessonTitle,
  startedLessonMinutes,
  libraryCount,
  coverUrl,
  showPawReward,
  pathTitle,
  onOpenPath,
  onPrimary,
  mode,
  progress,
  onModeChange,
  onViewDetails,
  onStartActivity,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [modesOpen, setModesOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

  const main = mainContent(
    t,
    heroState,
    nextStep,
    startedLessonTitle,
    startedLessonMinutes,
    libraryCount,
  );
  const selectedMode =
    MODE_OPTIONS.find(option => option.mode === mode) ?? MODE_OPTIONS[1];

  const hasSteps = progress != null && progress.steps.length > 0;
  const totalSteps = progress
    ? progress.steps.length + progress.hiddenStepCount
    : 0;
  const doneSteps = progress ? progress.doneIds.size : 0;
  const leftMinutes = progress
    ? Math.max(0, progress.totalMinutes - progress.doneMinutes)
    : 0;
  const nextId = progress?.nextActivity?.id ?? null;
  const summary = hasSteps
    ? progress.allDone
      ? t('home.today_summary_done', {count: totalSteps})
      : t('home.today_summary_left', {
          count: Math.max(0, totalSteps - doneSteps),
          minutes: leftMinutes,
        })
    : t('home.today_label');

  const primaryTestID =
    heroState === 'in_progress'
      ? 'home-continue-action'
      : heroState === 'next_activity'
        ? 'home-next-action'
        : heroState === 'saved_only'
          ? 'home-starter-pick'
          : heroState === 'no_lessons'
            ? 'home-starter-first'
            : 'home-hero-cta';

  return (
    <ShelfSurface
      borderRadius={26}
      containerTestID="home-today-suggestion"
      faceStyle={styles.face}
      shelfColor={PALETTE.shelf}
      shelfHeight={6}
    >
      <CardBackground coverUrl={coverUrl} styles={styles} />
      <View style={styles.inner} testID={`home-hero-${heroState}`}>
        {/* Summary (opens the Today screen) + mode chip */}
        <View style={styles.topRow}>
          <Pressable
            accessibilityHint={t('home.today_details_hint')}
            accessibilityLabel={t('home.today_details_a11y')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onViewDetails}
            style={({pressed: down}) => [
              styles.summaryLink,
              down && styles.pressed,
            ]}
            testID="home-today-details"
          >
            <AppText
              numberOfLines={1}
              style={styles.summary}
              testID="home-today-summary"
            >
              {summary}
            </AppText>
            <MaterialIcon
              color={PALETTE.tealInk}
              name="chevron_right"
              size={16}
            />
          </Pressable>
          <Pressable
            accessibilityHint={t('home.today_mode_toggle_hint')}
            accessibilityLabel={t('home.today_mode_toggle_a11y', {
              minutes: selectedMode.minutes,
            })}
            accessibilityRole="button"
            accessibilityState={{expanded: modesOpen}}
            hitSlop={8}
            onPress={() => setModesOpen(open => !open)}
            style={({pressed: down}) => [
              styles.modeChip,
              down && styles.pressed,
            ]}
            testID="home-today-mode-toggle"
          >
            <AppText style={styles.modeText}>
              {t(selectedMode.labelKey)}
            </AppText>
            <View style={modesOpen ? styles.chevronUp : styles.chevronDown}>
              <MaterialIcon
                color={PALETTE.ink}
                name="chevron_right"
                size={14}
              />
            </View>
          </Pressable>
        </View>

        {modesOpen ? (
          <View style={styles.modeRow}>
            {MODE_OPTIONS.map(option => {
              const selected = option.mode === mode;
              return (
                <Pressable
                  key={option.mode}
                  accessibilityHint={t('home.today_mode_a11y', {
                    minutes: option.minutes,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{selected}}
                  onPress={() => {
                    onModeChange(option.mode);
                    setModesOpen(false);
                  }}
                  style={[styles.modeOption, selected && styles.modeSelected]}
                  testID={`home-today-mode-${option.mode}`}
                >
                  <AppText
                    style={[
                      styles.modeOptionText,
                      selected && styles.modeSelectedText,
                    ]}
                  >
                    {t(option.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Main row: what to do now */}
        <Pressable
          accessibilityLabel={`${main.title}. ${main.cta}`}
          accessibilityRole="button"
          onPress={onPrimary}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={styles.mainRow}
          testID={primaryTestID}
        >
          <View style={styles.copy} testID="home-hero-copy">
            <AppText
              numberOfLines={1}
              style={styles.eyebrow}
              testID="home-hero-eyebrow"
            >
              {main.eyebrow}
            </AppText>
            <AppText numberOfLines={2} style={styles.title}>
              {main.title}
            </AppText>
            {main.body ? (
              <AppText numberOfLines={2} style={styles.body}>
                {main.body}
              </AppText>
            ) : null}
          </View>
          <View style={styles.spacer} />
          {main.play ? (
            <View style={[styles.play, pressed && styles.playPressed]}>
              <HomeIcon
                name={main.ctaIcon}
                size={24}
                color={PALETTE.white}
                testID="home-hero-cta-icon"
              />
            </View>
          ) : null}
        </Pressable>

        {!main.play || pathTitle ? (
          <View style={styles.pillRow}>
            {!main.play ? (
              <Pressable
                accessibilityLabel={main.cta}
                accessibilityRole="button"
                onPress={onPrimary}
                style={({pressed: down}) => [
                  styles.ctaPill,
                  down && styles.pressed,
                ]}
              >
                <HomeIcon name={main.ctaIcon} size={16} color={PALETTE.white} />
                <AppText numberOfLines={1} style={styles.ctaText}>
                  {main.cta}
                </AppText>
              </Pressable>
            ) : null}
            {pathTitle ? (
              <Pressable
                accessibilityLabel={t('home.hero_path_a11y', {
                  title: pathTitle,
                })}
                accessibilityRole="button"
                hitSlop={8}
                onPress={onOpenPath}
                style={({pressed: down}) => [
                  styles.pathPill,
                  down && styles.pressed,
                ]}
                testID="home-hero-path"
              >
                <HomeIcon name="school" size={14} color={PALETTE.ink} />
                <AppText numberOfLines={1} style={styles.pathText}>
                  {pathTitle}
                </AppText>
                <HomeIcon name="chevron_right" size={14} color={PALETTE.ink} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Today's route: one stop per visible plan step */}
        {hasSteps ? (
          <View style={styles.route} testID="home-today-progress">
            <View pointerEvents="none" style={styles.routeLine} />
            {progress.steps.map((step, index) => {
              const done = progress.doneIds.has(step.id);
              const isNext = step.id === nextId;
              return (
                <Pressable
                  key={step.id}
                  accessibilityHint={t('home.today_start_hint')}
                  accessibilityLabel={
                    done
                      ? t('home.today_step_done_a11y', {title: step.titleVi})
                      : t('home.today_start_a11y', {
                          title: step.titleVi,
                          minutes: step.estimatedMinutes,
                        })
                  }
                  accessibilityRole="button"
                  onPress={() => onStartActivity(step)}
                  style={({pressed: down}) => [
                    styles.stop,
                    down && styles.pressed,
                  ]}
                  testID={`home-today-step-${step.id}`}
                >
                  <View
                    style={[
                      styles.dot,
                      done && styles.dotDone,
                      isNext && styles.dotNext,
                    ]}
                  >
                    <AppText
                      style={[
                        styles.dotText,
                        isNext && styles.dotTextNext,
                        done && styles.dotTextDone,
                      ]}
                    >
                      {done ? '✓' : String(index + 1)}
                    </AppText>
                  </View>
                  <AppText
                    numberOfLines={1}
                    style={[styles.stopLabel, isNext && styles.stopLabelNext]}
                  >
                    {t(`home.step_short_${step.type}`)}
                  </AppText>
                  <AppText numberOfLines={1} style={styles.stopMeta}>
                    {t('home.today_step_minutes', {
                      minutes: step.estimatedMinutes,
                    })}
                  </AppText>
                </Pressable>
              );
            })}
            {progress.hiddenStepCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onViewDetails}
                style={styles.stop}
                testID="home-today-more"
              >
                <View style={styles.dot}>
                  <AppText style={styles.dotText}>
                    {`+${progress.hiddenStepCount}`}
                  </AppText>
                </View>
                <AppText numberOfLines={1} style={styles.stopLabel}>
                  {t('home.today_details')}
                </AppText>
              </Pressable>
            ) : null}
            {showPawReward ? (
              <View
                accessibilityLabel={t('home.weekly_goal_link')}
                style={styles.paw}
                testID="home-hero-paw-reward"
              >
                <View style={styles.pawTag}>
                  <AppText style={styles.pawTagText}>
                    {t('home.today_paw_tag')}
                  </AppText>
                </View>
                <AppText numberOfLines={1} style={styles.stopMeta}>
                  {t('home.weekly_goal_label')}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : (
          <AppText style={styles.empty} testID="home-today-empty">
            {t('home.today_empty')}
          </AppText>
        )}

        {hasSteps && progress.allDone ? (
          <AppText style={styles.allDone} testID="home-today-all-done">
            {t('home.today_all_done')}
          </AppText>
        ) : null}
      </View>
    </ShelfSurface>
  );
}

/**
 * The gradient face and, on its right, the picture fading into it: a cover
 * photo is masked to fade left and down; without one the cat sits there.
 */
function CardBackground({
  coverUrl,
  styles,
}: {
  coverUrl?: string | null;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id="homeTodayFace" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={PALETTE.faceFrom} />
            <Stop offset="1" stopColor={PALETTE.faceTo} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#homeTodayFace)" height="100%" width="100%" />
      </Svg>
      {coverUrl ? (
        <Svg height={ART_HEIGHT} style={styles.art} width="100%">
          <Defs>
            <LinearGradient id="homeTodayFadeX" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor={PALETTE.white} stopOpacity={0} />
              <Stop offset="0.45" stopColor={PALETTE.white} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id="homeTodayFadeY" x1="0" x2="0" y1="1" y2="0">
              <Stop offset="0" stopColor={PALETTE.white} stopOpacity={0} />
              <Stop offset="0.3" stopColor={PALETTE.white} stopOpacity={1} />
            </LinearGradient>
            <Mask id="homeTodayMaskX">
              <Rect fill="url(#homeTodayFadeX)" height="100%" width="100%" />
            </Mask>
            <Mask id="homeTodayMaskY">
              <Rect fill="url(#homeTodayFadeY)" height="100%" width="100%" />
            </Mask>
          </Defs>
          <G mask="url(#homeTodayMaskX)">
            <G mask="url(#homeTodayMaskY)">
              <SvgImage
                height="100%"
                href={{uri: coverUrl}}
                preserveAspectRatio="xMidYMid slice"
                testID="home-today-cover"
                width="100%"
              />
            </G>
          </G>
        </Svg>
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={CAT}
          style={styles.cat}
          testID="home-today-cat"
        />
      )}
    </View>
  );
}

function mainContent(
  t: (key: string, params?: Record<string, string | number>) => string,
  heroState: HeroState,
  nextStep: HomeTodayStep | null | undefined,
  startedLessonTitle: string | undefined,
  startedLessonMinutes: number | undefined,
  libraryCount: number | null | undefined,
): MainContent {
  switch (heroState) {
    case 'in_progress':
      return {
        eyebrow:
          startedLessonMinutes != null
            ? `${t('home.hero_eyebrow_in_progress')} · ${t(
                'home.today_step_minutes',
                {minutes: startedLessonMinutes},
              )}`
            : t('home.hero_eyebrow_in_progress'),
        title: startedLessonTitle ?? t('home.hero_in_progress_title'),
        body: null,
        cta:
          startedLessonMinutes != null
            ? t('home.hero_continue_cta', {minutes: startedLessonMinutes})
            : t('home.hero_in_progress_cta'),
        play: true,
        ctaIcon: 'play_arrow',
      };
    case 'next_activity':
      return nextStep
        ? {
            eyebrow: t('home.today_step_meta', {
              step: nextStep.step,
              total: nextStep.total,
              minutes: nextStep.minutes,
            }),
            title: nextStep.title,
            body: null,
            cta: t('home.hero_next_cta', {minutes: nextStep.minutes}),
            play: true,
            ctaIcon: 'play_arrow',
          }
        : {
            eyebrow: t('home.hero_eyebrow_next'),
            title: t('home.hero_saved_title'),
            body: null,
            cta: t('home.hero_saved_cta'),
            play: false,
            ctaIcon: 'menu_book',
          };
    case 'saved_only':
      return {
        eyebrow: t('home.hero_eyebrow_saved'),
        title: t('home.hero_saved_title'),
        body: t(
          libraryCount === 1
            ? 'home.hero_saved_body_one'
            : 'home.hero_saved_body_other',
          {count: libraryCount ?? 0},
        ),
        cta: t('home.hero_saved_cta'),
        play: false,
        ctaIcon: 'menu_book',
      };
    case 'goal_met':
      return {
        eyebrow: t('home.hero_eyebrow_goal_met'),
        title: t('home.hero_goal_met_title'),
        body: t('home.hero_goal_met_body'),
        cta: t('home.hero_goal_met_cta'),
        play: false,
        ctaIcon: 'menu_book',
      };
    case 'youtube_disabled':
      return {
        eyebrow: t('home.hero_eyebrow_youtube_disabled'),
        title: t('home.hero_youtube_disabled_title'),
        body: t('home.hero_youtube_disabled_body'),
        cta: t('home.hero_youtube_disabled_cta'),
        play: false,
        ctaIcon: 'menu_book',
      };
    case 'no_lessons':
      return {
        eyebrow: t('home.hero_eyebrow_no_lessons'),
        title: t('home.hero_no_lessons_title'),
        body: t('home.hero_no_lessons_body'),
        cta: t('home.hero_no_lessons_cta'),
        play: false,
        ctaIcon: 'auto_awesome',
      };
  }
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    face: {
      backgroundColor: PALETTE.faceFrom,
      overflow: 'hidden',
    },
    // The picture covers the right 56% of the card's top.
    art: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: '56%',
    },
    cat: {
      height: 132,
      position: 'absolute',
      right: 4,
      top: 14,
      width: '40%',
    },
    inner: {
      gap: 10,
      padding: 14,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    topRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    summaryLink: {
      alignItems: 'center',
      backgroundColor: PALETTE.chip,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      flexShrink: 1,
      gap: 2,
      minHeight: 28,
      paddingLeft: 10,
      paddingRight: 6,
    },
    summary: {
      color: PALETTE.tealInk,
      flexShrink: 1,
      fontSize: 12.5,
      fontWeight: '800',
    },
    modeChip: {
      alignItems: 'center',
      backgroundColor: PALETTE.chipStrong,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 2,
      minHeight: 28,
      paddingLeft: 10,
      paddingRight: 6,
    },
    modeText: {
      color: PALETTE.ink,
      fontSize: 12,
      fontWeight: '800',
    },
    chevronDown: {
      transform: [{rotate: '90deg'}],
    },
    chevronUp: {
      transform: [{rotate: '-90deg'}],
    },
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    modeOption: {
      backgroundColor: PALETTE.chip,
      borderRadius: theme.radius.pill,
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    modeSelected: {
      backgroundColor: PALETTE.teal,
    },
    modeOptionText: {
      color: PALETTE.ink,
      fontSize: 13,
      fontWeight: '700',
    },
    modeSelectedText: {
      color: PALETTE.white,
    },
    // Copy on the left, the play button over the picture's lower corner.
    mainRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 12,
      minHeight: 76,
    },
    copy: {
      gap: 2,
      minWidth: 0,
      width: '60%',
    },
    spacer: {
      flex: 1,
    },
    eyebrow: {
      color: PALETTE.tealInk,
      fontSize: 12.5,
      fontWeight: '700',
    },
    title: {
      color: PALETTE.ink,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 25,
    },
    body: {
      color: PALETTE.tealInk,
      fontSize: 13,
      lineHeight: 18,
    },
    play: {
      alignItems: 'center',
      backgroundColor: PALETTE.coral,
      borderBottomColor: PALETTE.coralShelf,
      borderBottomWidth: 4,
      borderRadius: 26,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    playPressed: {
      borderBottomWidth: 1,
      transform: [{translateY: 3}],
    },
    pillRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    ctaPill: {
      alignItems: 'center',
      backgroundColor: PALETTE.coral,
      borderBottomColor: PALETTE.coralShelf,
      borderBottomWidth: 3,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
    },
    ctaText: {
      color: PALETTE.white,
      fontSize: 14,
      fontWeight: '800',
    },
    pathPill: {
      alignItems: 'center',
      backgroundColor: PALETTE.sun,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      flexShrink: 1,
      gap: 4,
      maxWidth: '100%',
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    pathText: {
      color: PALETTE.ink,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
    },
    // White strip under the copy holding today's stops.
    route: {
      backgroundColor: PALETTE.strip,
      borderRadius: 16,
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingVertical: 9,
    },
    // Dashed thread behind the dots, from the first stop to the last.
    routeLine: {
      borderColor: PALETTE.dash,
      borderStyle: 'dashed',
      borderTopWidth: 2,
      left: 40,
      position: 'absolute',
      right: 40,
      top: 22,
    },
    stop: {
      alignItems: 'center',
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    dot: {
      alignItems: 'center',
      backgroundColor: PALETTE.white,
      borderColor: PALETTE.dash,
      borderRadius: 14,
      borderWidth: 2,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    dotDone: {
      backgroundColor: PALETTE.teal,
      borderColor: PALETTE.teal,
    },
    dotNext: {
      backgroundColor: PALETTE.coral,
      borderColor: PALETTE.coralRing,
      borderWidth: 4,
    },
    dotText: {
      color: PALETTE.tealInk,
      fontSize: 12,
      fontWeight: '800',
    },
    dotTextNext: {
      color: PALETTE.white,
    },
    dotTextDone: {
      color: PALETTE.white,
    },
    stopLabel: {
      color: PALETTE.ink,
      fontSize: 12,
      fontWeight: '700',
    },
    stopLabelNext: {
      color: PALETTE.ink,
      fontWeight: '800',
    },
    stopMeta: {
      color: PALETTE.tealInk,
      fontSize: 11,
      opacity: 0.85,
    },
    paw: {
      alignItems: 'center',
      gap: 3,
      paddingLeft: 4,
    },
    pawTag: {
      alignItems: 'center',
      backgroundColor: PALETTE.sun,
      borderBottomColor: PALETTE.sunShelf,
      borderBottomWidth: 3,
      borderRadius: 10,
      height: 28,
      justifyContent: 'center',
      paddingHorizontal: 8,
      transform: [{rotate: '-5deg'}],
    },
    pawTagText: {
      color: PALETTE.ink,
      fontSize: 12,
      fontWeight: '800',
    },
    empty: {
      backgroundColor: PALETTE.strip,
      borderRadius: 16,
      color: PALETTE.tealInk,
      fontSize: 13,
      overflow: 'hidden',
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    allDone: {
      color: PALETTE.tealInk,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
