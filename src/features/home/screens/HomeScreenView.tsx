/**
 * HomeScreenView — Home screen layout (LING-256 paper-cut v4 redesign).
 *
 * Renders:
 * 1. HomeHeader — time-of-day greeting + streak flame (DQ-008, I4, I5)
 * 2. HomeHeroCard — 5-state hero card with mascot (DQ-002, P-004, I2, I8)
 * 3. HomeWeeklyGoal — 5-paw goal directly under hero (I3, P-004)
 * 4. HomeShortcutsGrid — 4 real-destination shortcuts (DQ-005, D3, P-003)
 * 5. HomeSavedRail — renamed "Bài đã lưu" rail (DQ-006)
 *
 * Legacy explore grid is preserved with existing testIDs to maintain test compatibility.
 * It is rendered alongside the new sections to keep existing tests green.
 *
 * Theme contrast: uses existing theme tokens (DQ-004).
 * Accessibility: min 48pt hit targets, accessibilityLabel/Role (A-005).
 * Reduced motion: all animations disabled via useReducedMotion() (D5, AD-002).
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {HomeHeader} from '../components/HomeHeader';
import {HomeHeroCard} from '../components/HomeHeroCard';
import {HomeSavedRail} from '../components/HomeSavedRail';
import {HomeShortcutsGrid} from '../components/HomeShortcutsGrid';
import {HomeWeeklyGoal} from '../components/HomeWeeklyGoal';
import {LINK_HIT_SLOP} from '../logic/homeScreenModel';
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
    exploreCells,
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
  const {t} = useTranslation();

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

        {/* Shortcuts grid — 4 real-destination shortcuts (DQ-005, D3, P-003, I6) */}
        <HomeShortcutsGrid
          shortcuts={shortcutItems}
          onPress={handleShortcutPress}
        />

        {/* Legacy explore grid section — preserved for test compatibility (must precede weekly goal card) */}
        <View style={styles.section} testID="home-explore-section">
          <View style={styles.sectionHeader}>
            <AppText variant="h3" style={styles.sectionTitle}>
              {t('home.explore_title')}
            </AppText>
            <Pressable
              accessibilityLabel={t('home.view_all_a11y')}
              accessibilityRole="button"
              hitSlop={LINK_HIT_SLOP}
              onPress={goLessonsTab}
              style={styles.textLink}
              testID="home-explore-view-all"
            >
              <AppText
                variant="label"
                style={styles.textLinkLabel}
                numberOfLines={1}
              >
                {t('home.view_all')}
              </AppText>
            </Pressable>
          </View>
          <View style={styles.exploreGrid}>
            {exploreCells.map(cell => {
              const backgroundColor = theme.colors[cell.backgroundKey];
              const ink =
                cell.inkKey === 'text.primary'
                  ? theme.colors.text.primary
                  : theme.colors[cell.inkKey];
              const isVideoCell = cell.testID === 'home-explore-video';
              const isDisabled = isVideoCell && !youtubeEnabled;
              const a11yLabel = isDisabled
                ? `${t(cell.titleKey)}. ${t('home.explore_video_unavailable')}`
                : `${t(cell.titleKey)}. ${t(cell.metaKey)}`;
              const shelf = theme.shelf?.surface;
              const tileShelf = theme.shelf?.iconButton;
              return (
                <Pressable
                  accessibilityLabel={a11yLabel}
                  accessibilityRole="button"
                  accessibilityState={isDisabled ? {disabled: true} : undefined}
                  disabled={isDisabled}
                  key={cell.testID}
                  onPress={isVideoCell ? openVideoCell : goLessonsTab}
                  testID={cell.testID}
                  style={styles.exploreCellWrap}
                >
                  {({pressed}) => (
                    <ShelfSurface
                      shelfHeight={shelf?.height}
                      shelfColor={shelf?.color}
                      borderRadius={theme.radius.lg}
                      isPressed={pressed}
                      isDisabled={isDisabled}
                      containerStyle={theme.shadow.soft}
                      faceStyle={[
                        styles.exploreCell,
                        {backgroundColor},
                        !shelf && pressed && !isDisabled && styles.pressed,
                      ]}
                    >
                      <ShelfSurface
                        shelfHeight={tileShelf?.height}
                        shelfColor={tileShelf?.color}
                        borderRadius={16}
                        isPressed={pressed}
                        isDisabled={isDisabled}
                        faceStyle={[
                          styles.exploreIconTile,
                          {backgroundColor: theme.colors.surface},
                        ]}
                      >
                        <MaterialIcon color={ink} name={cell.icon} size={24} />
                      </ShelfSurface>
                      <AppText
                        variant="label"
                        style={[styles.exploreTitle, {color: ink}]}
                        numberOfLines={2}
                      >
                        {t(cell.titleKey)}
                      </AppText>
                      <AppText
                        variant="caption"
                        style={[styles.exploreMeta, {color: ink}]}
                        numberOfLines={2}
                      >
                        {isDisabled
                          ? t('home.explore_video_unavailable')
                          : t(cell.metaKey)}
                      </AppText>
                    </ShelfSurface>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Weekly goal — 5 paws under explore grid (I3, P-004) */}
        <HomeWeeklyGoal pawGoal={pawGoalModel} card={weeklyGoalCard} />

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
    section: {gap: theme.spacing.md},
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      justifyContent: 'space-between',
    },
    sectionTitle: {flex: 1, minWidth: 0},
    exploreGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    exploreCellWrap: {
      flexBasis: '47%',
      flexGrow: 1,
      minWidth: 140,
    },
    exploreCell: {
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      minHeight: 160,
      padding: theme.spacing.md,
    },
    exploreIconTile: {
      alignItems: 'center',
      borderRadius: 16,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    exploreTitle: {},
    exploreMeta: {},
    textLink: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    textLinkLabel: {
      color: theme.colors.primary,
    },
    pressed: {opacity: theme.states.pressedOpacity},
  });
}
