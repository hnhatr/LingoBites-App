/**
 * HomeTodayCard — the one teal "Hôm nay" card at the top of Home.
 *
 * It replaces the old hero card and the "Hôm nay học gì?" plan card, which
 * both pointed at the same next step:
 *   [Còn 2 việc · khoảng 18 phút ›            🎯 20 phút ▾]
 *   [cover] Bước 2/3 · ~8 phút                         (▶)
 *           Bài học mới: Chọn chỗ ngồi
 *           [A1 – Du lịch cơ bản ›]
 *   [✓ Ôn thẻ ┄┄ ② Bài mới ┄┄ ③ Luyện nói ┄┄ +1 🐾]
 *
 * The main row follows the six hero states; the route shows today's plan
 * steps (each opens its activity) and the "+1 🐾" tag while the step
 * finishes a lesson that counts this week. The summary line opens the full
 * Today screen; the mode chip opens the 5/20/45-minute choices in place.
 */
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import type {StudyActivityItem, TodayMode} from '@features/today';

import {AppText} from '@ui/components/AppText';
import {type CoverGlyph, LibraryCover} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {HeroState} from '../logic/homeScreenModel';
import type {TodayProgressModel} from '../logic/todayProgress';
import {HomeIcon, type HomeSvgIconName} from './HomeSvgIcons';

/** The card keeps its own colours in every theme, as the hero card did. */
const PALETTE = {
  face: '#006b5f',
  shelf: '#004a41',
  mint: '#2dd4bf',
  mintShelf: '#17a595',
  mintInk: '#00413a',
  white: '#ffffff',
  soft: '#cdeee8',
  glass: 'rgba(255,255,255,0.16)',
  glassBorder: 'rgba(255,255,255,0.28)',
  dash: 'rgba(255,255,255,0.3)',
  ring: 'rgba(45,212,191,0.45)',
  sun: '#ffd166',
  sunShelf: '#e0a92e',
  sunInk: '#1c1c10',
};

const MODE_OPTIONS: ReadonlyArray<{
  mode: TodayMode;
  labelKey: string;
  minutes: number;
}> = [
  {mode: '5-minute', labelKey: 'home.today_mode_5', minutes: 5},
  {mode: 'normal', labelKey: 'home.today_mode_20', minutes: 20},
  {mode: 'deep-practice', labelKey: 'home.today_mode_45', minutes: 45},
];

const STEP_GLYPH: Record<StudyActivityItem['type'], CoverGlyph> = {
  due_review: 'cards',
  error_remediation: 'cards',
  active_recall: 'cards',
  listening_remediation: 'subtitles',
  prerequisite_lesson: 'book',
  next_lesson: 'book',
  continue_lesson: 'book',
  old_situation_practice: 'chat',
  speaking_practice: 'chat',
  interview_practice: 'work',
};

const STATE_GLYPH: Record<HeroState, CoverGlyph> = {
  no_lessons: 'school',
  saved_only: 'book',
  in_progress: 'book',
  next_activity: 'book',
  goal_met: 'check',
  youtube_disabled: 'book',
};

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

  const glyph =
    heroState === 'next_activity' && nextStep
      ? STEP_GLYPH[nextStep.type]
      : STATE_GLYPH[heroState];
  const celebrate = heroState === 'goal_met';
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
      <View pointerEvents="none" style={styles.glow} />
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
            <MaterialIcon color={PALETTE.mint} name="chevron_right" size={16} />
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
                color={PALETTE.white}
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
          {celebrate ? (
            <View style={styles.trophy}>
              <HomeIcon name="emoji_events" size={30} color={PALETTE.sunInk} />
            </View>
          ) : (
            <View style={styles.cover}>
              <LibraryCover
                compact
                glyph={glyph}
                hideLevelChip
                imageUrl={coverUrl}
                shape="pack"
                testID="home-today-cover"
              />
            </View>
          )}
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
          {main.play ? (
            <View style={[styles.play, pressed && styles.playPressed]}>
              <HomeIcon
                name={main.ctaIcon}
                size={24}
                color={PALETTE.mintInk}
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
                <HomeIcon
                  name={main.ctaIcon}
                  size={16}
                  color={PALETTE.mintInk}
                />
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
                <HomeIcon name="school" size={14} color={PALETTE.white} />
                <AppText numberOfLines={1} style={styles.pathText}>
                  {pathTitle}
                </AppText>
                <HomeIcon
                  name="chevron_right"
                  size={14}
                  color={PALETTE.white}
                />
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
      backgroundColor: PALETTE.face,
      overflow: 'hidden',
    },
    // Soft mint light in the top-right corner.
    glow: {
      backgroundColor: PALETTE.mint,
      borderRadius: 90,
      height: 180,
      opacity: 0.18,
      position: 'absolute',
      right: -50,
      top: -70,
      width: 180,
    },
    inner: {
      gap: 12,
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
      flexDirection: 'row',
      flexShrink: 1,
      gap: 2,
      minHeight: 28,
    },
    summary: {
      color: PALETTE.mint,
      flexShrink: 1,
      fontSize: 12.5,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    modeChip: {
      alignItems: 'center',
      backgroundColor: PALETTE.glass,
      borderColor: PALETTE.glassBorder,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 2,
      paddingLeft: 10,
      paddingRight: 6,
      paddingVertical: 4,
    },
    modeText: {
      color: PALETTE.white,
      fontSize: 12,
      fontWeight: '700',
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
      backgroundColor: PALETTE.glass,
      borderRadius: theme.radius.pill,
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    modeSelected: {
      backgroundColor: PALETTE.white,
    },
    modeOptionText: {
      color: PALETTE.white,
      fontSize: 13,
      fontWeight: '700',
    },
    modeSelectedText: {
      color: PALETTE.face,
    },
    mainRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    cover: {
      borderColor: PALETTE.glassBorder,
      borderRadius: 18,
      borderWidth: 2,
      height: 64,
      overflow: 'hidden',
      width: 64,
    },
    trophy: {
      alignItems: 'center',
      backgroundColor: PALETTE.sun,
      borderRadius: 18,
      height: 64,
      justifyContent: 'center',
      transform: [{rotate: '-4deg'}],
      width: 64,
    },
    copy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    eyebrow: {
      color: PALETTE.soft,
      fontSize: 12.5,
      fontWeight: '700',
    },
    title: {
      color: PALETTE.white,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 23,
    },
    body: {
      color: PALETTE.soft,
      fontSize: 13,
      lineHeight: 18,
    },
    play: {
      alignItems: 'center',
      backgroundColor: PALETTE.mint,
      borderBottomColor: PALETTE.mintShelf,
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
      backgroundColor: PALETTE.mint,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
    },
    ctaText: {
      color: PALETTE.mintInk,
      fontSize: 14,
      fontWeight: '800',
    },
    pathPill: {
      alignItems: 'center',
      backgroundColor: PALETTE.glass,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      flexShrink: 1,
      gap: 4,
      maxWidth: '100%',
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    pathText: {
      color: PALETTE.white,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
    },
    route: {
      borderTopColor: PALETTE.dash,
      borderStyle: 'dashed',
      borderTopWidth: 1.5,
      flexDirection: 'row',
      paddingTop: 12,
    },
    // Dashed thread behind the dots, from the first stop to the last.
    routeLine: {
      borderColor: PALETTE.dash,
      borderStyle: 'dashed',
      borderTopWidth: 2,
      left: 36,
      position: 'absolute',
      right: 36,
      top: 26,
    },
    stop: {
      alignItems: 'center',
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    dot: {
      alignItems: 'center',
      backgroundColor: PALETTE.face,
      borderColor: PALETTE.dash,
      borderRadius: 14,
      borderWidth: 2,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    dotDone: {
      backgroundColor: PALETTE.mint,
      borderColor: PALETTE.mint,
    },
    dotNext: {
      backgroundColor: PALETTE.white,
      borderColor: PALETTE.ring,
      borderWidth: 4,
    },
    dotText: {
      color: PALETTE.soft,
      fontSize: 12,
      fontWeight: '800',
    },
    dotTextNext: {
      color: PALETTE.face,
    },
    dotTextDone: {
      color: PALETTE.mintInk,
    },
    stopLabel: {
      color: PALETTE.soft,
      fontSize: 12,
      fontWeight: '700',
    },
    stopLabelNext: {
      color: PALETTE.white,
    },
    stopMeta: {
      color: PALETTE.soft,
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
      color: PALETTE.sunInk,
      fontSize: 12,
      fontWeight: '800',
    },
    empty: {
      color: PALETTE.soft,
      fontSize: 13,
    },
    allDone: {
      color: PALETTE.white,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
