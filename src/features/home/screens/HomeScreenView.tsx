/**
 * HomeScreenView — Home screen layout (LING-256, LING-267, §VS-0..§VS-8).
 *
 * Renders in mockup v4 order (AC-1, FR-001):
 * 1. HomeHeader — time-of-day greeting + streak flame (DQ-008, I4, I5)
 * 2. HomeHeroCard — 5-state hero card with mascot (DQ-002, P-004, I2, I8)
 * 3. HomeTodaySuggestion — "Gợi ý hôm nay" under "Học tiếp" (F12)
 * 4. HomeWeeklyGoal — 5-paw goal (I3, P-004)
 * 5. HomeShortcutsGrid — "Lối tắt" + 4 real-destination shortcuts (DQ-005, D3, P-003)
 * 6. HomeSavedRail — "Bài đã lưu" rail (DQ-006)
 *
 * Header is inside the ScrollView and scrolls with the content.
 * Confetti (I7) is rendered once as a full-screen overlay when goal_met.
 */
import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {ConfettiOverlay} from '../components/HomeDecorations';
import {HomeHeader} from '../components/HomeHeader';
import {HomeHeroCard} from '../components/HomeHeroCard';
import {HomeSavedRail} from '../components/HomeSavedRail';
import {HomeShortcutsGrid} from '../components/HomeShortcutsGrid';
import {HomeTodaySuggestion} from '../components/HomeTodaySuggestion';
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
    todayMode,
    todayPlan,
    onTodayModeChange,
    onStartTodayActivity,
    onViewTodayDetails,
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
      case 'video':
        if (youtubeEnabled) {
          openVideoCell();
        }
        break;
      case 'review':
        onNavigateReview();
        break;
      case 'speaking':
        onNavigateSpeaking();
        break;
      case 'lessons':
        onNavigateLessonList();
        break;
    }
  };

  const isGoalMet = heroState === 'goal_met';

  return (
    <AppScreen>
      {/* Screen-level full overlay for goal_met state (I7, A-006, §VS-7) */}
      <ConfettiOverlay visible={isGoalMet} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: Math.max(feedClearance, 28)},
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header (§VS-1) scrolls with content (FR-001) */}
        <HomeHeader
          greeting={greetingModel}
          streak={streak}
          flame={flameModel}
        />

        {/* Hero card (§VS-2) */}
        <View style={styles.heroSection}>
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
        </View>

        {/* "Gợi ý hôm nay" (F12) directly under the "Học tiếp" hero */}
        <View style={styles.todaySection}>
          <HomeTodaySuggestion
            mode={todayMode}
            plan={todayPlan}
            onModeChange={onTodayModeChange}
            onStartActivity={onStartTodayActivity}
            onViewDetails={onViewTodayDetails}
          />
        </View>

        {/* Weekly goal (§VS-3) */}
        <View style={styles.goalSection}>
          <HomeWeeklyGoal pawGoal={pawGoalModel} card={weeklyGoalCard} />
        </View>

        {/* Shortcuts grid (§VS-4) */}
        <View style={styles.shortcutsSection}>
          <HomeShortcutsGrid
            shortcuts={shortcutItems}
            onPress={handleShortcutPress}
          />
        </View>

        {/* Saved rail (§VS-5) */}
        <View style={styles.railSection}>
          <HomeSavedRail
            items={railItems}
            onItem={openRecentItem}
            onViewAll={goLessonsTab}
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(_theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
    },
    heroSection: {
      marginBottom: 18,
    },
    todaySection: {
      marginBottom: 18,
    },
    goalSection: {
      marginBottom: 22,
    },
    shortcutsSection: {
      marginBottom: 22,
    },
    railSection: {
      marginBottom: 10,
    },
  });
}
