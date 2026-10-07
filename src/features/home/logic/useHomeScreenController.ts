/**
 * useHomeScreenController — orchestrates Home screen data (LING-256).
 *
 * Wires:
 * - getDueFlashcards() for review shortcut badge (AD-003, P-003, D2)
 * - 5 hero states from local downloads/progress/goal (DQ-002, P-004)
 * - Time-of-day greeting (I5, DQ-008)
 * - Streak flame model (I4, P-001)
 * - 5-paw weekly goal (I3, P-004)
 * - 4-shortcut grid; Video opens the video hub (DQ-005, D3)
 * - Saved rail with renamed label (DQ-006)
 * - Graceful degradation when progress percent unavailable (A-009)
 * - "Gợi ý hôm nay" card from the Today study-block engine (F12)
 */
import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo, useState} from 'react';

import {useAccountStore} from '@features/account';
import {trackEvent} from '@features/analytics';
import {getGamificationSnapshot} from '@features/engagement';
import {useYouTubeLessonCreation} from '@features/input';
import {
  type LessonCardLocalState,
  readLessonCardLocalState,
  useSavedLessons,
} from '@features/lesson/library';
import {
  type DownloadedLessonSummary,
  listDownloadedLessonSummaries,
  useCanonicalCatalog,
} from '@features/lesson/player';
import {getDueFlashcards} from '@features/review';
import {
  generateStudyBlock,
  getLearnerStateSnapshot,
  type LearnerStateSnapshot,
  openStudyActivity,
  type StudyActivityItem,
  type StudyBlockPlan,
  type TodayMode,
} from '@features/today';

import {useAppNavigation} from '@core/navigation';
import {removeLessonBookmark} from '@core/sync/lessonBookmarks';
import {listInProgressLessonIds} from '@core/sync/lessonProgress';

import {
  buildFlameModel,
  buildGreeting,
  buildPawGoalModel,
  buildShortcutItems,
  buildWeeklyGoalCard,
  deriveHeroState,
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

/**
 * Most recently started downloaded lesson that is not finished, from local
 * `lesson_progress` (A-009: no progress percentage exposed).
 */
function findStartedDownload(
  downloads: DownloadedLessonSummary[],
): DownloadedLessonSummary | null {
  if (downloads.length === 0) return null;
  for (const lessonId of listInProgressLessonIds()) {
    const match = downloads.find(item => item.lessonId === lessonId);
    if (match) return match;
  }
  return null;
}

export function useHomeScreenController() {
  const navigation = useAppNavigation();
  const youtubeEnabled = useYouTubeLessonCreation().status === 'available';
  const canonicalCatalog = useCanonicalCatalog();
  const canonicalRefresh = canonicalCatalog.refresh;
  const displayName = useAccountStore(state => state.user?.display_name);
  const trimmedDisplayName = useMemo(
    () => trimDisplayName(displayName),
    [displayName],
  );

  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  // Downloads and progress for the saved rail's cards, re-read on focus.
  const [lessonCardState, setLessonCardState] = useState<LessonCardLocalState>(
    readLessonCardLocalState,
  );
  const [startedDownload, setStartedDownload] =
    useState<DownloadedLessonSummary | null>(null);
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
  const [todayMode, setTodayMode] = useState<TodayMode>('normal');
  const [learnerSnapshot, setLearnerSnapshot] =
    useState<LearnerStateSnapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      canonicalRefresh();
      setLessonCardState(readLessonCardLocalState());
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
          badgeTarget: snapshot.weeklyGoal.badgeTarget,
        }),
      );
      let downloads: DownloadedLessonSummary[] = [];
      try {
        downloads = listDownloadedLessonSummaries();
        setDownloadCount(downloads.length);
      } catch {
        setDownloadCount(null);
      }
      try {
        setStartedDownload(findStartedDownload(downloads));
      } catch {
        setStartedDownload(null);
      }
      // Due flashcard count for review shortcut badge (AD-003, P-003)
      try {
        setDueFlashcardCount(getDueFlashcards().length);
      } catch {
        setDueFlashcardCount(null);
      }
      // Learner snapshot for the "Gợi ý hôm nay" card (F12)
      try {
        setLearnerSnapshot(getLearnerStateSnapshot());
      } catch {
        setLearnerSnapshot(null);
      }
    }, [canonicalRefresh]),
  );

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
      }),
    [dueFlashcardCount],
  );

  // "Gợi ý hôm nay" study block, same engine as the Today screen (F12)
  const todayPlan: StudyBlockPlan | null = useMemo(() => {
    if (!learnerSnapshot) return null;
    try {
      return generateStudyBlock(learnerSnapshot, todayMode);
    } catch {
      return null;
    }
  }, [learnerSnapshot, todayMode]);

  // Saved rail items (DQ-006): the lessons the learner bookmarked.
  const savedLessons = useSavedLessons();
  const railItems: RecentItem[] = useMemo(() => {
    const saved = savedLessons.slice(0, RAIL_LIMIT);
    if (saved.length === 0) {
      return [];
    }
    const local = lessonCardState;
    return saved.map(item => ({
      id: item.lessonId,
      title: item.title,
      levelTitle: item.contextLabel ?? undefined,
      typeLabelKey: typeLabelKeyForSource(item.sourceType),
      minutes:
        item.estimatedMinutes ??
        (item.sentenceCount > 0
          ? Math.max(1, Math.ceil(item.sentenceCount * 0.5))
          : undefined),
      isDownloaded: local.downloadedIds.has(item.lessonId),
      icon: railIconForSource(item.sourceType),
      sourceType: item.sourceType,
      sentenceCount: item.sentenceCount,
      progress: local.progress.get(item.lessonId),
      exerciseCount: local.activityCounts.get(item.lessonId),
    }));
  }, [savedLessons, lessonCardState]);

  const openRecentItem = useCallback(
    (item: RecentItem) => {
      trackEvent('unified_lesson_opened', {
        lesson_id: item.id,
        source: 'home_rail',
      });
      navigation.openLesson(item.id);
    },
    [navigation],
  );

  const unsaveRecentItem = useCallback((item: RecentItem) => {
    try {
      removeLessonBookmark(item.id);
    } catch {
      // Database not ready: the card stays saved.
    }
  }, []);

  const goLessonsTab = useCallback(
    () => navigation.goToTab('Lessons'),
    [navigation],
  );

  const openVideoCell = useCallback(
    () => navigation.openVideoHub(),
    [navigation],
  );

  const onNavigateCreate = useCallback(
    () => navigation.openCreate(),
    [navigation],
  );

  const onNavigateLessonList = useCallback(
    () => navigation.openToday(),
    [navigation],
  );

  const onContinueStartedLesson = useCallback(() => {
    if (!startedDownload) return;
    navigation.openLesson(startedDownload.lessonId);
  }, [navigation, startedDownload]);

  const onNavigateReview = useCallback(
    () => navigation.openReview(),
    [navigation],
  );

  const onNavigateSpeaking = useCallback(
    () => navigation.openSpeakingRoom(),
    [navigation],
  );

  const onStartTodayActivity = useCallback(
    (activity: StudyActivityItem) => openStudyActivity(navigation, activity),
    [navigation],
  );

  const onViewTodayDetails = useCallback(
    () => navigation.openToday({mode: todayMode}),
    [navigation, todayMode],
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
    dueFlashcardCount,
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
    railItems,
    youtubeEnabled,
    // "Gợi ý hôm nay" (F12)
    todayMode,
    todayPlan,
    onTodayModeChange: setTodayMode,
    onStartTodayActivity,
    onViewTodayDetails,
    // Navigation handlers
    goLessonsTab,
    openVideoCell,
    openRecentItem,
    unsaveRecentItem,
    onNavigateCreate,
    onNavigateLessonList,
    onContinueStartedLesson,
    onNavigateReview,
    onNavigateSpeaking,
  };
}

export type HomeScreenViewModel = ReturnType<typeof useHomeScreenController>;
