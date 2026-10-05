/**
 * HomeScreenView — Home screen layout (LING-256 paper-cut v4 redesign).
 *
 * Renders in mockup v4 order (AC-1):
 * 1. HomeHeader — time-of-day greeting + streak flame (DQ-008, I4, I5)
 * 2. HomeHeroCard — 5-state hero card with mascot (DQ-002, P-004, I2, I8)
 * 3. HomeWeeklyGoal — 5-paw goal directly under hero (I3, P-004)
 * 4. HomeShortcutsGrid — "Lối tắt" + 4 real-destination shortcuts (DQ-005, D3, P-003)
 * 5. HomeSavedRail — renamed "Bài đã lưu" rail (DQ-006)
 *
 * Theme contrast: uses existing theme tokens (DQ-004).
 * Accessibility: min 48pt hit targets, accessibilityLabel/Role (A-005).
 * Reduced motion: all animations disabled via useReducedMotion() (D5, AD-002).
 */
import React, {useMemo} from 'react';
import {ScrollView, StyleSheet} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {HomeHeader} from '../components/HomeHeader';
import {HomeHeroCard} from '../components/HomeHeroCard';
import {HomeSavedRail} from '../components/HomeSavedRail';
import {HomeShortcutsGrid} from '../components/HomeShortcutsGrid';
import {HomeWeeklyGoal} from '../components/HomeWeeklyGoal';
import type {HomeScreenViewModel} from '../logic/useHomeScreenController';

export function HomeScreenView(props: HomeScreenViewModel) {
  const {
    heroState,
    greetingModel,
    streak,
    flameModel,
    weeklyGoalCard,
    pawGoalModel,
    shortcutItems,
    trimmedDisplayName,
    libraryCount,
    startedLesson,
    railItems,
    youtubeEnabled,
    goLessonsTab,
    openVideoCell,
    openRecentItem,
    onNavigateCreate,
    onNavigateLessonList,
    onContinueStartedLesson,
    onNavigateReview,
    onNavigateSpeaking,
  } = props;
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Shortcut navigation handler
  const handleShortcutPress = (key: (typeof shortcutItems)[0]['key']) => {
    switch (key) {
      case 'review':
        onNavigateReview();
        break;
      case 'speaking':
        onNavigateSpeaking();
        break;
      case 'lessons':
        onNavigateLessonList();
        break;
      case 'video':
        if (youtubeEnabled) {
          openVideoCell();
        }
        break;
    }
  };

  return (
    <AppScreen>
      {/* Header: time-of-day greeting + streak flame — no app brand (DQ-008, D7) */}
      <HomeHeader greeting={greetingModel} streak={streak} flame={flameModel} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: feedClearance},
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card — 5 states (DQ-002, P-004, I2, I8) */}
        <HomeHeroCard
          heroState={heroState}
          streak={streak}
          displayName={trimmedDisplayName}
          startedLessonTitle={startedLesson?.titleVi}
          startedLessonMinutes={startedLesson?.estimatedDurationMinutes}
          libraryCount={libraryCount}
          onPrimary={
            heroState === 'in_progress'
              ? onContinueStartedLesson
              : heroState === 'saved_only'
              ? onNavigateLessonList
              : onNavigateCreate
          }
        />

        {/* Weekly goal — 5 paws directly under hero (I3, P-004) — mockup v4 order */}
        <HomeWeeklyGoal pawGoal={pawGoalModel} card={weeklyGoalCard} />

        {/* Shortcuts grid — "Lối tắt" + 4 real-destination shortcuts (DQ-005, D3, P-003, I6) */}
        <HomeShortcutsGrid
          shortcuts={shortcutItems}
          onPress={handleShortcutPress}
        />

        {/* Saved lessons rail (DQ-006) */}
        <HomeSavedRail
          items={railItems}
          onItem={openRecentItem}
          onViewAll={goLessonsTab}
          onCreateFirst={onNavigateCreate}
        />
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      gap: theme.spacing.xl,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
  });
}
