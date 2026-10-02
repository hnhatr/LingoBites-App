import {type NavigationProp, useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';

import {trackEvent} from '@features/analytics';
import {getGamificationSnapshot} from '@features/engagement';
import {
  fetchContinueLearning,
  listDownloadedLessonSummaries,
  openLesson,
  useCanonicalCatalog,
} from '@features/lesson/player';

import {useYouTubeServerEnabled} from '@core/api/youtubeCapabilities';
import {useFeatureFlags} from '@core/release';
import {getLessonProgress} from '@core/sync/lessonProgress';

import type {
  HomeStackParamList,
  RootTabParamList,
} from '../screens/navigationTypes';
import {
  type ExploreCell,
  type RecentItem,
  toCanonicalRecentItem,
  UNIFIED_RAIL_LIMIT,
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
  // Same gate as the Create tab's YouTube tile: app flag AND server.
  const youtubeServerEnabled = useYouTubeServerEnabled();
  const youtubeEnabled =
    config.features.youtubeLearning && youtubeServerEnabled;
  const canonicalCatalog = useCanonicalCatalog();
  const canonicalRefresh = canonicalCatalog.refresh;
  const catalogState = canonicalCatalog.state;
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [continueLessonId, setContinueLessonId] = useState<string | null>(null);
  const [streak, setStreak] = useState<number>(
    () => getGamificationSnapshot().currentStreak,
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
      setStreak(getGamificationSnapshot().currentStreak);
      try {
        setDownloadCount(listDownloadedLessonSummaries().length);
      } catch {
        setDownloadCount(null);
      }
    }, [canonicalRefresh]),
  );

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

  const showStarter = !startedDownload;
  const starterBare = showStarter && (downloadCount ?? 0) === 0;
  const heroPick = showStarter && !starterBare && (downloadCount ?? 0) > 0;

  const goLessonsTab = useCallback(
    () => tabNavigation?.navigate('Lessons'),
    [tabNavigation],
  );

  const openVideoCell = useCallback(
    () => tabNavigation?.navigate('Create'),
    [tabNavigation],
  );

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

  const railItems: RecentItem[] = useMemo(() => {
    const downloaded = listDownloadedLessonSummaries()
      .slice(0, UNIFIED_RAIL_LIMIT)
      .map(item => ({
        kind: 'canonical' as const,
        id: item.lessonId,
        title: item.title,
        meta: `${item.estimatedDurationMinutes} phút`,
      }));
    if (downloaded.length > 0) {
      return downloaded;
    }
    const canonicalItems =
      catalogState.status === 'ready' ? catalogState.lessons : [];
    return canonicalItems
      .slice(0, UNIFIED_RAIL_LIMIT)
      .map(toCanonicalRecentItem);
  }, [catalogState]);

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

  const onOpenSettings = useCallback(
    () => tabNavigation?.navigate('Profile'),
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

  return {
    streak,
    showStarter,
    starterBare,
    heroPick,
    libraryCount: downloadCount,
    startedLesson: startedDownload
      ? {
          id: startedDownload.lessonId,
          titleVi: startedDownload.title,
          estimatedDurationMinutes: startedDownload.estimatedDurationMinutes,
          level: 'A2',
        }
      : null,
    exploreCells,
    railItems,
    youtubeEnabled,
    goLessonsTab,
    openVideoCell,
    openRecentItem,
    onOpenSettings,
    onNavigateCreate,
    onNavigateLessonList,
    onContinueStartedLesson,
  };
}

export type HomeScreenViewModel = ReturnType<typeof useHomeScreenController>;
