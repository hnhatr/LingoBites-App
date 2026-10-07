/**
 * useHomeScreenController — orchestrates Home screen data (LING-256).
 *
 * Wires:
 * - getDueFlashcards() for review shortcut badge (AD-003, P-003, D2)
 * - 6 hero states from local downloads/progress/plan/goal (DQ-002, P-004)
 * - Time-of-day greeting (I5, DQ-008)
 * - Streak flame model (I4, P-001)
 * - Paw weekly goal, one paw per target lesson (I3, P-004)
 * - 4-shortcut grid with Video locked when YouTube is off (DQ-005, D3)
 * - Saved rail with renamed label (DQ-006)
 * - Graceful degradation when progress percent unavailable (A-009)
 * - "Kế hoạch hôm nay" checklist from the Today study-block engine (F12),
 *   kept per day and ticked off from local study events
 */
import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {useAccountStore} from '@features/account';
import {trackEvent} from '@features/analytics';
import {
  getGamificationSnapshot,
  listStudyEventsOn,
  type StudyEvent,
} from '@features/engagement';
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

import {useYouTubeServerEnabled} from '@core/api/youtubeCapabilities';
import {useAppNavigation} from '@core/navigation';
import {useFeatureFlags} from '@core/release';
import {removeLessonBookmark} from '@core/sync/lessonBookmarks';
import {listInProgressLessonIds} from '@core/sync/lessonProgress';

import type {HeroNextStep} from '../components/HomeHeroCard';
import {
  readStoredTodayPlan,
  writeStoredTodayPlan,
} from './data/TodayPlanRepository';
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
import {
  buildTodayProgress,
  isLessonStep,
  localDayKey,
  reusableTodayPlan,
  type TodayProgressModel,
} from './todayProgress';

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
  const {config} = useFeatureFlags();
  const navigation = useAppNavigation();
  const youtubeServerEnabled = useYouTubeServerEnabled();
  const youtubeEnabled =
    config.features.youtubeLearning && youtubeServerEnabled;
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
  // Same-day mode survives a restart because the day's plan stores it.
  const [todayMode, setTodayMode] = useState<TodayMode>(() => {
    const stored = readStoredTodayPlan();
    return stored?.dayKey === localDayKey(new Date()) ? stored.mode : 'normal';
  });
  const [todayEvents, setTodayEvents] = useState<StudyEvent[]>([]);
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
      // Learner snapshot for the "Kế hoạch hôm nay" card (F12)
      try {
        setLearnerSnapshot(getLearnerStateSnapshot());
      } catch {
        setLearnerSnapshot(null);
      }
      // Finished sessions today tick the plan's steps off
      setTodayEvents(listStudyEventsOn(new Date()));
    }, [canonicalRefresh]),
  );

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

  // "Kế hoạch hôm nay" study block, same engine as the Today screen (F12).
  // The day's plan is reused so done steps stay listed as done.
  const todayPlan: StudyBlockPlan | null = useMemo(() => {
    if (!learnerSnapshot) return null;
    const reused = reusableTodayPlan(
      readStoredTodayPlan(),
      localDayKey(new Date()),
      todayMode,
    );
    if (reused) return reused;
    try {
      return generateStudyBlock(learnerSnapshot, todayMode);
    } catch {
      return null;
    }
  }, [learnerSnapshot, todayMode]);

  useEffect(() => {
    if (todayPlan && todayPlan.activities.length > 0) {
      writeStoredTodayPlan({
        dayKey: localDayKey(new Date()),
        mode: todayMode,
        plan: todayPlan,
      });
    }
  }, [todayPlan, todayMode]);

  const todayProgress: TodayProgressModel | null = useMemo(
    () => (todayPlan ? buildTodayProgress(todayPlan, todayEvents) : null),
    [todayPlan, todayEvents],
  );
  const nextActivity = todayProgress?.nextActivity ?? null;

  // 6 hero states (DQ-002, P-004)
  const heroState: HeroState = useMemo(
    () =>
      deriveHeroState({
        downloadCount: downloadCount ?? 0,
        hasInProgress: startedDownload != null,
        hasNextActivity: nextActivity != null,
        weeklyGoalMet: completedThisWeek >= weeklyTarget,
        youtubeEnabled,
      }),
    [
      downloadCount,
      startedDownload,
      nextActivity,
      completedThisWeek,
      weeklyTarget,
      youtubeEnabled,
    ],
  );

  const heroNextStep: HeroNextStep | null = useMemo(() => {
    if (!todayPlan || !nextActivity) return null;
    return {
      title: nextActivity.titleVi,
      minutes: nextActivity.estimatedMinutes,
      step: todayPlan.activities.indexOf(nextActivity) + 1,
      total: todayPlan.activities.length,
    };
  }, [todayPlan, nextActivity]);

  // Id of the plan step the hero is pointing at, if any.
  const currentStepId: string | null = useMemo(() => {
    if (heroState === 'next_activity') return nextActivity?.id ?? null;
    if (heroState === 'in_progress' && startedDownload && todayPlan) {
      return (
        todayPlan.activities.find(
          step => step.targetId === startedDownload.lessonId,
        )?.id ?? null
      );
    }
    return null;
  }, [heroState, nextActivity, startedDownload, todayPlan]);

  // The weekly-goal link line shows while the hero's step finishes a lesson
  const nextStepIsLesson =
    heroState === 'in_progress' ||
    (heroState === 'next_activity' && isLessonStep(nextActivity));

  // Legacy flags preserved for existing HomeScreenView logic
  const showStarter =
    heroState === 'no_lessons' ||
    heroState === 'youtube_disabled' ||
    heroState === 'saved_only';
  const starterBare = heroState === 'no_lessons';
  const heroPick = heroState === 'saved_only';

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
    () => navigation.startCreate({kind: 'youtube'}),
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

  const onStartNextActivity = useCallback(() => {
    if (!nextActivity) return;
    openStudyActivity(navigation, nextActivity);
  }, [navigation, nextActivity]);

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
    // "Kế hoạch hôm nay" (F12)
    todayMode,
    todayPlan,
    todayProgress,
    heroNextStep,
    currentStepId,
    nextStepIsLesson,
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
    onStartNextActivity,
    onNavigateReview,
    onNavigateSpeaking,
  };
}

export type HomeScreenViewModel = ReturnType<typeof useHomeScreenController>;
