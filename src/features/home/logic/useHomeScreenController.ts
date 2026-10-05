/**
 * useHomeScreenController — orchestrates Home screen data (LING-256).
 *
 * Wires:
 * - getDueFlashcards() for review shortcut badge (AD-003, P-003, D2)
 * - 5 hero states from local downloads/progress/goal (DQ-002, P-004)
 * - Time-of-day greeting (I5, DQ-008)
 * - Streak flame model (I4, P-001)
 * - 5-paw weekly goal (I3, P-004)
 * - 4-shortcut grid with Video locked when YouTube is off (DQ-005, D3)
 * - Saved rail with renamed label (DQ-006)
 * - Graceful degradation when progress percent unavailable (A-009)
 */
import {type NavigationProp, useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';

import {useAccountStore} from '@features/account';
import {trackEvent} from '@features/analytics';
import {getGamificationSnapshot} from '@features/engagement';
import {
  fetchContinueLearning,
  listDownloadedLessonSummaries,
  openLesson,
  useCanonicalCatalog,
} from '@features/lesson/player';
import {getDueFlashcards} from '@features/review';

import {useYouTubeServerEnabled} from '@core/api/youtubeCapabilities';
import {useFeatureFlags} from '@core/release';
import {getLessonProgress} from '@core/sync/lessonProgress';

import type {
  HomeStackParamList,
  RootTabParamList,
} from '../screens/navigationTypes';
import {
  buildFlameModel,
  buildGreeting,
  buildPawGoalModel,
  buildShortcutItems,
  buildWeeklyGoalCard,
  deriveHeroState,
  type ExploreCell,
  type FlameModel,
  type GreetingModel,
  type HeroState,
  type PawGoalModel,
  RAIL_LIMIT,
  railIconForSource,
  type RecentItem,
  type ShortcutItem,
  trimDisplayName,
  typeLabelKeyForSource,
  type WeeklyGoalCardModel,
} from './homeScreenModel';

type HomeNavigation = NativeStackScreenProps<
  HomeStackParamList,
  'HomeMain'
>['navigation'];

type Args = {
  navigation: HomeNavigation;
};

export function useHomeScreenController({navigation}: Args) {
  const {config} = useFeatureFlags();
  const tabNavigation =
    navigation.getParent<NavigationProp<RootTabParamList>>();
  const youtubeServerEnabled = useYouTubeServerEnabled();
  const youtubeEnabled =
    config.features.youtubeLearning && youtubeServerEnabled;
  const canonicalCatalog = useCanonicalCatalog();
  const canonicalRefresh = canonicalCatalog.refresh;
  const catalogState = canonicalCatalog.state;
  const displayName = useAccountStore(state => state.user?.display_name);
  const trimmedDisplayName = useMemo(
    () => trimDisplayName(displayName),
    [displayName],
  );

  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [continueLessonId, setContinueLessonId] = useState<string | null>(null);
  const [streak, setStreak] = useState<number>(
    () => getGamificationSnapshot().currentStreak,
  );
  const [weeklyGoalCard, setWeeklyGoalCard] = useState<WeeklyGoalCardModel>(
    () =>
      buildWeeklyGoalCard({
        completedThisWeek: 0,
        target: 6,
        badgeEarned: false,
      }),
  );
  const [completedThisWeek, setCompletedThisWeek] = useState<number>(0);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(6);
  const [dueFlashcardCount, setDueFlashcardCount] = useState<number | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      canonicalRefresh();
      fetchContinueLearning()
        .then(res => {
          if (res.ok && res.progress) {
            setContinueLessonId(res.progress.lesson_id);
          } else {
            setContinueLessonId(null);
          }
        })
        .catch(() => undefined);
      const snapshot = getGamificationSnapshot();
      setStreak(snapshot.currentStreak);
      const completed = snapshot.weeklyGoal.completedThisWeek;
      const target = snapshot.weeklyGoal.target;
      setCompletedThisWeek(completed);
      setWeeklyTarget(target);
      setWeeklyGoalCard(
        buildWeeklyGoalCard({
          completedThisWeek: completed,
          target,
          badgeEarned: snapshot.badges.some(badge => badge.id === 'diligent'),
        }),
      );
      try {
        setDownloadCount(listDownloadedLessonSummaries().length);
      } catch {
        setDownloadCount(null);
      }
      // Due flashcard count for review shortcut badge (AD-003, P-003)
      try {
        setDueFlashcardCount(getDueFlashcards().length);
      } catch {
        setDueFlashcardCount(null);
      }
    }, [canonicalRefresh]),
  );

  // Determine in-progress lesson (A-009: no progress percentage exposed)
  const startedDownload = useMemo(() => {
    const downloads = listDownloadedLessonSummaries();
    for (const item of downloads) {
      const progress = getLessonProgress(item.lessonId);
      if (progress?.status === 'in_progress') {
        return item;
      }
    }
    if (continueLessonId) {
      return downloads.find(item => item.lessonId === continueLessonId) ?? null;
    }
    return null;
  }, [continueLessonId]);

  // 5 hero states (DQ-002, P-004)
  const heroState: HeroState = useMemo(
    () =>
      deriveHeroState({
        downloadCount: downloadCount ?? 0,
        hasInProgress: startedDownload != null,
        weeklyGoalMet: completedThisWeek >= weeklyTarget,
        youtubeEnabled,
      }),
    [
      downloadCount,
      startedDownload,
      completedThisWeek,
      weeklyTarget,
      youtubeEnabled,
    ],
  );

  // Legacy flags preserved for existing HomeScreenView logic
  const showStarter =
    heroState === 'no_lessons' ||
    heroState === 'youtube_disabled' ||
    heroState === 'saved_only';
  const starterBare = heroState === 'no_lessons';
  const heroPick = heroState === 'saved_only';

  // Time-of-day greeting (I5, DQ-008)
  const greetingModel: GreetingModel = useMemo(
    () => buildGreeting(new Date().getHours(), trimmedDisplayName),
    [trimmedDisplayName],
  );

  // Streak flame model (I4, P-001)
  const flameModel: FlameModel = useMemo(
    () => buildFlameModel(streak),
    [streak],
  );

  // 5-paw weekly goal (I3, P-004)
  const pawGoalModel: PawGoalModel = useMemo(
    () => buildPawGoalModel(completedThisWeek, weeklyTarget),
    [completedThisWeek, weeklyTarget],
  );

  // 4-shortcut items (DQ-005, D3, P-003)
  const shortcutItems: ShortcutItem[] = useMemo(
    () =>
      buildShortcutItems({
        dueFlashcardCount,
        youtubeEnabled,
      }),
    [dueFlashcardCount, youtubeEnabled],
  );

  // Saved rail items (DQ-006)
  const railItems: RecentItem[] = useMemo(() => {
    const downloaded = listDownloadedLessonSummaries().slice(0, RAIL_LIMIT);
    if (downloaded.length > 0) {
      return downloaded.map(item => ({
        id: item.lessonId,
        title: item.title,
        levelTitle: item.snapshot.unit?.level_title,
        typeLabelKey: typeLabelKeyForSource(item.snapshot.source_type),
        minutes: item.estimatedDurationMinutes,
        isDownloaded: true,
        icon: railIconForSource(item.snapshot.source_type),
      }));
    }
    const canonicalItems =
      catalogState.status === 'ready' ? catalogState.lessons : [];
    return canonicalItems.slice(0, RAIL_LIMIT).map(item => ({
      id: item.id,
      title: item.title,
      levelTitle: item.unit?.level_title ?? undefined,
      typeLabelKey: typeLabelKeyForSource(item.source_type),
      minutes: undefined,
      isDownloaded: false,
      icon: railIconForSource(item.source_type),
    }));
  }, [catalogState]);

  // Legacy explore cells (kept for existing HomeScreenView until TASK-003 replaces it)
  const exploreCells: ExploreCell[] = useMemo(
    () => [
      {
        icon: 'play_circle',
        backgroundKey: 'accentSoft',
        inkKey: 'primary',
        titleKey: 'home.explore_video',
        metaKey: 'home.explore_video_meta',
        testID: 'home-explore-video',
      },
      {
        icon: 'article',
        backgroundKey: 'tertiarySoft',
        inkKey: 'onTertiaryContainer',
        titleKey: 'home.explore_news',
        metaKey: 'home.explore_news_meta',
        testID: 'home-explore-news',
      },
      {
        icon: 'smartphone',
        backgroundKey: 'secondarySoft',
        inkKey: 'secondary',
        titleKey: 'home.explore_offline',
        metaKey: 'home.explore_offline_meta',
        testID: 'home-explore-offline',
      },
      {
        icon: 'fitness_center',
        backgroundKey: 'surfaceContainer',
        inkKey: 'text.primary',
        titleKey: 'home.explore_practice',
        metaKey: 'home.explore_practice_meta',
        testID: 'home-explore-practice',
      },
    ],
    [],
  );

  const openRecentItem = useCallback(
    (item: RecentItem) => {
      trackEvent('unified_lesson_opened', {
        lesson_id: item.id,
        source: 'home_rail',
      });
      openLesson(navigation, item.id);
    },
    [navigation],
  );

  const goLessonsTab = useCallback(
    () => tabNavigation?.navigate('Lessons'),
    [tabNavigation],
  );

  const openVideoCell = useCallback(
    () => tabNavigation?.navigate('Create'),
    [tabNavigation],
  );

  const onNavigateCreate = useCallback(
    () => tabNavigation?.navigate('Create'),
    [tabNavigation],
  );

  const onNavigateLessonList = useCallback(
    () => navigation.navigate('Today'),
    [navigation],
  );

  const onContinueStartedLesson = useCallback(() => {
    if (!startedDownload) return;
    openLesson(navigation, startedDownload.lessonId);
  }, [navigation, startedDownload]);

  const onNavigateReview = useCallback(
    () => navigation.navigate('DailyReview'),
    [navigation],
  );

  const onNavigateSpeaking = useCallback(
    () => navigation.navigate('SpeakingRoom'),
    [navigation],
  );

  return {
    // Hero state
    heroState,
    showStarter,
    starterBare,
    heroPick,
    // Greeting (I5, DQ-008)
    greetingModel,
    // Streak
    streak,
    flameModel,
    // Weekly goal
    weeklyGoalCard,
    pawGoalModel,
    // Shortcuts (DQ-005, D3, P-003)
    shortcutItems,
    // General
    trimmedDisplayName,
    libraryCount: downloadCount,
    startedLesson: startedDownload
      ? {
          id: startedDownload.lessonId,
          titleVi: startedDownload.title,
          estimatedDurationMinutes: startedDownload.estimatedDurationMinutes,
        }
      : null,
    // Legacy explore cells (still used by HomeScreenView during TASK-003 transition)
    exploreCells,
    railItems,
    youtubeEnabled,
    // Navigation handlers
    goLessonsTab,
    openVideoCell,
    openRecentItem,
    onNavigateCreate,
    onNavigateLessonList,
    onContinueStartedLesson,
    onNavigateReview,
    onNavigateSpeaking,
  };
}

export type HomeScreenViewModel = ReturnType<typeof useHomeScreenController>;
