import {type NavigationProp, useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';

import {trackEvent} from '@features/analytics';
import {getGamificationSnapshot} from '@features/engagement';
import {
  type ContentLessonRow,
  listSavedLessons,
  listStartedLessons,
  useContentLibrary,
} from '@features/lesson/packages';
import {
  fetchContinueLearning,
  isUnifiedLessonReady,
  useLessonCatalog,
  useLessonServerCapabilities,
} from '@features/lesson/player';
import {countYouTubeLessons, listYouTubeLessons} from '@features/youtube';

import {useYouTubeServerEnabled} from '@core/api/youtubeCapabilities';
import {useFeatureFlags} from '@core/release';

import type {
  HomeStackParamList,
  RootStackParamList,
  RootTabParamList,
} from '../screens/navigationTypes';
import {
  type ExploreCell,
  type RecentItem,
  type RelearnTarget,
  SUGGESTION_LIMIT,
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
  const rootNavigation =
    tabNavigation?.getParent<NavigationProp<RootStackParamList>>('RootStack');
  const {getContentLessonById, listActivePackageLessons} = useContentLibrary();
  const lessonCapabilities = useLessonServerCapabilities(
    config.features.unifiedLesson !== false,
  );
  const unifiedMode = isUnifiedLessonReady(config.features, lessonCapabilities);
  const canonicalCatalog = useLessonCatalog({enabled: unifiedMode});
  const canonicalRefresh = canonicalCatalog.refresh;
  const canonicalItems = canonicalCatalog.items;
  const [startedLesson, setStartedLesson] = useState<ContentLessonRow | null>(
    null,
  );
  const [ownItems, setOwnItems] = useState<RecentItem[]>([]);
  const [suggestions, setSuggestions] = useState<RecentItem[]>([]);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [relearnTarget, setRelearnTarget] = useState<RelearnTarget | null>(
    null,
  );
  const [youtubeLessonCount, setYoutubeLessonCount] = useState<number | null>(
    null,
  );
  const [_continueLearningId, setContinueLearningId] = useState<string | null>(
    null,
  );
  const [streak, setStreak] = useState<number>(
    () => getGamificationSnapshot().currentStreak,
  );

  useFocusEffect(
    useCallback(() => {
      if (unifiedMode) {
        canonicalRefresh();
      }
      fetchContinueLearning()
        .then(res => {
          if (res.ok && res.progress) {
            setContinueLearningId(res.progress.lesson_id);
          } else {
            setContinueLearningId(null);
          }
        })
        .catch(() => undefined);
      setStreak(getGamificationSnapshot().currentStreak);
      const started = listStartedLessons()[0];
      const startedRow = started
        ? getContentLessonById(started.lessonId)
        : null;
      setStartedLesson(startedRow);

      setOwnItems([]);

      let packaged: ReturnType<typeof listActivePackageLessons> = [];
      let count: number | null = null;
      try {
        packaged = listActivePackageLessons();
        count = packaged.length;
      } catch {
        count = null;
      }
      setLibraryCount(count);
      setSuggestions(
        packaged
          .filter(item => item.id !== startedRow?.id)
          .slice(0, SUGGESTION_LIMIT)
          .map(item => ({
            kind: 'packaged' as const,
            id: item.id,
            title: item.titleVi,
            meta: `${item.level} · ${item.estimatedDurationMinutes} phút`,
            level: item.level,
          })),
      );

      const candidates: (RelearnTarget & {at: string})[] = [];
      const newestSaved = listSavedLessons()[0];
      if (newestSaved) {
        const row = getContentLessonById(newestSaved.lessonId);
        if (row) {
          candidates.push({
            kind: 'packaged',
            id: row.id,
            title: row.titleVi,
            level: row.level,
            at: newestSaved.updatedAt,
          });
        }
      }
      candidates.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      const [newest] = candidates;
      setRelearnTarget(
        newest
          ? {
              kind: newest.kind,
              id: newest.id,
              title: newest.title,
              level: newest.level,
            }
          : null,
      );

      try {
        setYoutubeLessonCount(countYouTubeLessons());
      } catch {
        setYoutubeLessonCount(null);
      }
    }, [
      canonicalRefresh,
      getContentLessonById,
      listActivePackageLessons,
      unifiedMode,
    ]),
  );

  const showStarter = !startedLesson;
  const starterBare = showStarter && libraryCount === 0 && !relearnTarget;
  const heroPick = showStarter && !starterBare && (libraryCount ?? 0) > 0;

  const youtubeServerEnabled = useYouTubeServerEnabled();
  const hasSavedYouTubeLessons =
    youtubeLessonCount != null && youtubeLessonCount > 0;
  const youtubeEnabled =
    config.features.youtubeLearning &&
    (youtubeServerEnabled || hasSavedYouTubeLessons);

  const goLessonsTab = useCallback(
    () => tabNavigation?.navigate('Lessons'),
    [tabNavigation],
  );

  const openVideoCell = useCallback(() => {
    let hasSavedLessons = false;
    let readFailed = false;
    try {
      hasSavedLessons = listYouTubeLessons().length > 0;
    } catch {
      readFailed = true;
    }
    if (readFailed || hasSavedLessons) {
      rootNavigation?.navigate('YouTubeHistory');
    } else {
      tabNavigation?.navigate('Create', {
        screen: 'YouTubeInput',
        params: {fromHome: true},
      });
    }
  }, [rootNavigation, tabNavigation]);

  const exploreCells: ExploreCell[] = useMemo(
    () => [
      {
        icon: 'play_circle',
        backgroundKey: 'accentSoft',
        inkKey: 'primary',
        titleKey: 'home.explore_video',
        metaKey: 'home.explore_video_meta',
        testID: 'home-explore-video',
        badgeKey:
          youtubeLessonCount !== null && youtubeLessonCount > 0
            ? 'home.explore_video_badge'
            : undefined,
        badgeParams:
          youtubeLessonCount !== null && youtubeLessonCount > 0
            ? {count: youtubeLessonCount}
            : undefined,
        tagKey:
          youtubeLessonCount !== null && youtubeLessonCount > 0
            ? 'home.explore_video_tag'
            : undefined,
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
    [youtubeLessonCount],
  );

  const railItems: RecentItem[] = useMemo(() => {
    if (unifiedMode) {
      return canonicalItems
        .slice(0, UNIFIED_RAIL_LIMIT)
        .map(toCanonicalRecentItem);
    }
    const seen = new Set<string>();
    const items: RecentItem[] = [];
    if (startedLesson) {
      seen.add(startedLesson.id);
      items.push({
        kind: 'packaged',
        id: startedLesson.id,
        title: startedLesson.titleVi,
        meta: `${startedLesson.level} · ${startedLesson.estimatedDurationMinutes} phút`,
        level: startedLesson.level,
      });
    }
    for (const item of [...ownItems, ...suggestions]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    return items;
  }, [unifiedMode, canonicalItems, startedLesson, ownItems, suggestions]);

  const openRecentItem = useCallback(
    (item: RecentItem) => {
      if (item.kind === 'canonical') {
        trackEvent('unified_lesson_opened', {
          lesson_id: item.id,
          source: 'home_rail',
        });
        navigation.navigate('CurriculumLesson', {lessonId: item.id});
        return;
      }
      navigation.navigate('ContentLessonRuntime', {lessonId: item.id});
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
    () =>
      tabNavigation?.navigate('Lessons', {
        screen: 'ContentLessonList',
      }),
    [tabNavigation],
  );

  const onContinueStartedLesson = useCallback(() => {
    if (!startedLesson) return;
    navigation.navigate('ContentLessonRuntime', {
      lessonId: startedLesson.id,
    });
  }, [navigation, startedLesson]);

  return {
    streak,
    showStarter,
    starterBare,
    heroPick,
    libraryCount,
    startedLesson,
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
