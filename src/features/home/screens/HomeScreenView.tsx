/**
 * HomeScreenView — Home screen layout (LING-256, LING-267, §VS-0..§VS-8).
 *
 * Renders in mockup v4 order (AC-1, FR-001):
 * 1. HomeHeader — time-of-day greeting + streak flame (DQ-008, I4, I5)
 * 2. HomeHeroCard — 5-state hero card with mascot (DQ-002, P-004, I2, I8)
 * 3. HomeTodaySuggestion — "Kế hoạch hôm nay" checklist under the hero (F12)
 * 4. HomeWeeklyGoal — one paw per target lesson (I3, P-004)
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
import {HomeReviewBanner} from '../components/HomeReviewBanner';
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
    dueFlashcardCount,
    trimmedDisplayName,
    libraryCount,
    startedLesson,
    railItems,
    todayMode,
    todayProgress,
    currentStepId,
    heroNextStep,
    nextStepIsLesson,
    onTodayModeChange,
    onStartTodayActivity,
    onViewTodayDetails,
    goLessonsTab,
    openVideoCell,
    openRecentItem,
    unsaveRecentItem,
    onNavigateCreate,
    onNavigateLessonList,
    onContinueStartedLesson,
    onStartNextActivity,
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
        openVideoCell();
        break;
      case 'review':
        onNavigateReview();
        break;
      case 'speaking':
        onNavigateSpeaking();
        break;
      case 'create':
        onNavigateCreate();
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

        {/* Due cards: first thing under the header so it is seen at once */}
        {dueFlashcardCount != null && dueFlashcardCount > 0 ? (
          <View style={styles.reviewSection}>
            <HomeReviewBanner
              count={dueFlashcardCount}
              onPress={onNavigateReview}
            />
          </View>
        ) : null}

        {/* Hero card (§VS-2) */}
        <View style={styles.heroSection}>
          <HomeHeroCard
            heroState={heroState}
            streak={streak}
            displayName={trimmedDisplayName}
            startedLessonTitle={startedLesson?.titleVi}
            startedLessonMinutes={startedLesson?.estimatedDurationMinutes}
            libraryCount={libraryCount}
            nextStep={heroNextStep}
            onPrimary={
              heroState === 'in_progress'
                ? onContinueStartedLesson
                : heroState === 'next_activity'
                ? onStartNextActivity
                : heroState === 'saved_only'
                ? onNavigateLessonList
                : onNavigateCreate
            }
          />
        </View>

        {/* "Kế hoạch hôm nay" (F12): the hero's step is one row of this plan */}
        <View style={styles.todaySection}>
          <HomeTodaySuggestion
            mode={todayMode}
            progress={todayProgress}
            currentStepId={currentStepId}
            onModeChange={onTodayModeChange}
            onStartActivity={onStartTodayActivity}
            onViewDetails={onViewTodayDetails}
          />
        </View>

        {/* Weekly goal (§VS-3) */}
        <View style={styles.goalSection}>
          <HomeWeeklyGoal
            pawGoal={pawGoalModel}
            card={weeklyGoalCard}
            nextStepIsLesson={nextStepIsLesson}
          />
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
            onUnsave={unsaveRecentItem}
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
    reviewSection: {
      marginBottom: 14,
    },
    heroSection: {
      marginBottom: 18,
    },
    todaySection: {
      marginBottom: 18,
    },
    goalSection: {
      marginBottom: 18,
    },
    shortcutsSection: {
      marginBottom: 22,
    },
    railSection: {
      marginBottom: 10,
    },
  });
}
