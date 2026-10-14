/**
 * HomeScreenView — Home screen layout (LING-256, LING-267, "hành trình").
 *
 * Order, top to bottom, all compact so "Luyện thêm" shows on open:
 * 1. HomeHeader — the cat, time-of-day greeting and streak flame
 * 2. HomeWeeklyGoal — one paw per target lesson, a thin strip
 * 3. HomeTodayCard — one bright card: the next thing to do (six hero
 *    states) and today's plan as a route of stops, with the "+1 🐾" tag
 * 4. HomeShortcutsGrid — "Luyện thêm", 4 same-size tinted tiles; due cards
 *    show as the review tile's badge
 * 5. HomeSavedRail — "Bài đã lưu" rail (DQ-006)
 *
 * Header is inside the ScrollView and scrolls with the content.
 * Confetti (I7) is rendered once as a full-screen overlay when goal_met.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {ConfettiOverlay} from '../components/HomeDecorations';
import {HomeHeader} from '../components/HomeHeader';
import {HomeSavedRail} from '../components/HomeSavedRail';
import {HomeShortcutsGrid} from '../components/HomeShortcutsGrid';
import {HomeTodayCard} from '../components/HomeTodayCard';
import {HomeWeeklyGoal} from '../components/HomeWeeklyGoal';
import type {HeroState} from '../logic/homeScreenModel';
import type {HomeScreenViewModel} from '../logic/useHomeScreenController';

const MASCOT_SPEECH: Record<HeroState, string> = {
  no_lessons: 'home.mascot_no_lessons',
  saved_only: 'home.mascot_saved',
  in_progress: 'home.mascot_in_progress',
  next_activity: 'home.mascot_next',
  goal_met: 'home.mascot_goal_met',
  youtube_disabled: 'home.mascot_youtube_disabled',
};

export function HomeScreenView(props: HomeScreenViewModel) {
  const {
    heroState,
    greetingModel,
    streak,
    flameModel,
    weeklyGoalCard,
    pawGoalModel,
    shortcutItems,
    libraryCount,
    startedLesson,
    railItems,
    todayMode,
    todayProgress,
    heroNextStep,
    todayCoverUrl,
    nextStepIsLesson,
    onTodayModeChange,
    onViewTodayDetails,
    onStartTodayActivity,
    learningPathTitle,
    onOpenLearningPath,
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
  const {t} = useTranslation();
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
          mascotLabel={t(MASCOT_SPEECH[heroState])}
        />

        {/* Weekly goal (§VS-3): a thin strip above the card */}
        <View style={styles.weekSection}>
          <HomeWeeklyGoal pawGoal={pawGoalModel} card={weeklyGoalCard} />
        </View>

        {/* "Hôm nay": the next step and today's route in one card */}
        <View style={styles.todaySection}>
          <HomeTodayCard
            heroState={heroState}
            nextStep={heroNextStep}
            startedLessonTitle={startedLesson?.titleVi}
            startedLessonMinutes={startedLesson?.estimatedDurationMinutes}
            libraryCount={libraryCount}
            coverUrl={todayCoverUrl}
            showPawReward={nextStepIsLesson && !pawGoalModel.goalMet}
            pathTitle={learningPathTitle}
            onOpenPath={onOpenLearningPath}
            onPrimary={
              heroState === 'in_progress'
                ? onContinueStartedLesson
                : heroState === 'next_activity'
                  ? onStartNextActivity
                  : heroState === 'saved_only'
                    ? onNavigateLessonList
                    : onNavigateCreate
            }
            mode={todayMode}
            progress={todayProgress}
            onModeChange={onTodayModeChange}
            onViewDetails={onViewTodayDetails}
            onStartActivity={onStartTodayActivity}
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
    weekSection: {
      marginBottom: 14,
    },
    todaySection: {
      marginBottom: 18,
    },
    shortcutsSection: {
      marginBottom: 18,
    },
    railSection: {
      marginBottom: 10,
    },
  });
}
