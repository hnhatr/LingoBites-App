import React, {useCallback, useMemo, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect, type NavigationProp} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {
  HomeStackParamList,
  RootStackParamList,
  RootTabParamList,
} from '@/app/navigation/types';
import {AppButton} from '@components/AppButton';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {IconButton} from '@components/IconButton';
import {MaterialIcon} from '@components/MaterialIcon';
import {ShelfSurface} from '@components/ShelfSurface';
import {getGamificationSnapshot} from '@modules/engagement';
import type {HandoffIconName} from '@components/icons/iconRegistry';
import {useContentLibrary, type ContentLessonRow} from '../content';
import {
  listSavedLessons,
  listStartedLessons,
} from '@shared/db/ContentLessonStateRepository';
import {
  listYouTubeLessons,
  countYoutubeLessons,
} from '@shared/db/YoutubeLessonRepository';
import {useYouTubeServerEnabled} from '@shared/api/youtubeCapabilities';
import {useFeatureFlags} from '@/release';
import {
  isUnifiedLessonReady,
  useLessonCatalog,
  useLessonServerCapabilities,
  type UnifiedLessonSummary,
} from '@modules/curriculumLesson';
import {trackEvent} from '../analytics';
import {useAppTheme, type AppTheme} from '@theme';
import {useFloatingTabBarClearance} from '@/app/navigation/tabBarMetrics';
import {useTranslation} from 'react-i18next';
import {fetchContinueLearning} from '@shared/api/learningClient';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

// 2×2 explore grid from the paper-cut mock (SETE-279). Background/ink pairs
// reuse the contrast-locked chip convention (accentSoft+primary,
// tertiarySoft+onTertiaryContainer, secondarySoft+secondary) plus the
// standard surfaceContainer+text.primary body pairing for the fourth cell.
type ExploreCell = {
  icon: HandoffIconName;
  backgroundKey:
    | 'accentSoft'
    | 'tertiarySoft'
    | 'secondarySoft'
    | 'surfaceContainer';
  inkKey: 'primary' | 'onTertiaryContainer' | 'secondary' | 'text.primary';
  titleKey: string;
  metaKey: string;
  testID: string;
  // SETE-311 Option B: data-bearing slots are optional. A card whose metric
  // has no real source leaves the key unset and the row collapses — never a
  // placeholder. Today all four cards ship slot-free.
  badgeKey?: string;
  badgeParams?: Record<string, string | number>;
  tagKey?: string;
};

type RecentItem = {
  kind: 'personal' | 'packaged' | 'canonical';
  id: string;
  title: string;
  meta: string;
  level?: string;
};

type RelearnTarget = {
  kind: 'personal' | 'packaged';
  id: string;
  title: string;
  level: string;
};

const RECENT_LIMIT = 3;
const SUGGESTION_LIMIT = 3;
// LING-41 TASK-006: unified rail shows the first canonical catalog page
// (same budget as the legacy personal + suggestion rails combined).
const UNIFIED_RAIL_LIMIT = RECENT_LIMIT + SUGGESTION_LIMIT;
const LINK_HIT_SLOP = {top: 10, bottom: 10, left: 10, right: 10};

// SETE-281: hero card palette sampled from the design reference (deep-blue
// card, coral/mint blobs, light badge pill, yellow CTA). These are fixed
// brand colors — identical in every theme — because the card background is
// fixed too (theme `inverse` ink is near-black in the dark theme, so theme
// tokens cannot be used here).
const HERO_BLUE = '#226FAB';
const HERO_CORAL = '#EB6B6C';
const HERO_MINT = '#6BD2AD';
const HERO_BADGE_BG = '#DAF1FA';
const HERO_BADGE_INK = '#134F7E';
const HERO_TITLE = '#FFFFFF';
const HERO_CTA_BG = '#FFD35E';
const HERO_CTA_INK = '#40320D';

/**
 * LING-41 TASK-006: map one canonical catalog summary to a rail card.
 * Summaries carry no level; duration (when present) is the meta, with
 * the description as fallback so the card never renders an empty row.
 */
function toCanonicalRecentItem(item: UnifiedLessonSummary): RecentItem {
  return {
    kind: 'canonical',
    id: item.id,
    title: item.title,
    meta:
      item.estimatedMinutes != null
        ? `${item.estimatedMinutes} phút`
        : item.description ?? '',
  };
}

/**
 * Paper-cut home (SETE-279): hero → 2×2 explore grid → "Tiếp tục học" rail.
 * The hero always shows one CTA — "Học tiếp" while a lesson is started,
 * otherwise a single pick/create entry — so no data combination leaves the
 * screen without an action. No fake numbers: no weekly-goal ring
 * (no weekly-goal source), no progress bar — just meta. The header streak
 * pill shows the real currentStreak and hides entirely at 0.
 * The video explore cell has its real data-driven destination (SETE-283);
 * the other three still point at the Lessons tab until mapped.
 */
export function HomeScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const {config} = useFeatureFlags();
  const feedClearance = useFloatingTabBarClearance();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const tabNavigation =
    navigation.getParent<NavigationProp<RootTabParamList>>();
  // SETE-289: the RootStack sits above the tabs; History is a root route
  // reached via the stack id so the call stays type-safe.
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

  // SETE-311: header streak pill. Recomputed from the persisted event log on
  // every focus — the same pattern as ProfileScreen — so the pill can never
  // show a stale count.
  const [streak, setStreak] = useState<number>(
    () => getGamificationSnapshot().currentStreak,
  );

  // SETE-278: track learning states. The lists are fast and small, re-read on
  // every focus.
  useFocusEffect(
    useCallback(() => {
      if (unifiedMode) {
        canonicalRefresh();
      }
      fetchContinueLearning().then(res => {
        if (res.ok && res.progress) {
          setContinueLearningId(res.progress.lesson_id);
        } else {
          setContinueLearningId(null);
        }
      }).catch(() => undefined);
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

      // "Học lại bài cũ": newest saved-or-personal lesson by timestamp.
      // No is_completed flag exists yet, so recency is the proxy.
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
        setYoutubeLessonCount(countYoutubeLessons());
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
  // The hero collapses to a single create CTA only when the library is
  // verifiably empty and there is no past lesson to revisit.
  const starterBare = showStarter && libraryCount === 0 && !relearnTarget;
  // Single hero CTA priority: pick from the packaged library when it is
  // verifiably non-empty, otherwise create. The past lesson (relearnTarget),
  // if any, stays reachable through the rail below.
  const heroPick = showStarter && !starterBare && (libraryCount ?? 0) > 0;

  // SETE-279: temporary destinations. The three non-video cells still land
  // on the Lessons tab until their real routes are mapped.
  const goLessonsTab = () => tabNavigation?.navigate('Lessons');
  // SETE-290 (DEV-1): the video entry is enabled only when both the app
  // flag and the server capability agree. While the probe is in flight or
  // fails, the cell stays disabled and no transcript request is sent.
  // SETE-345: saved lessons stay reachable offline — when the user already
  // has lessons stored locally (youtubeLessonCount > 0), the entry stays
  // enabled even if the server probe fails so History remains openable.
  const youtubeServerEnabled = useYouTubeServerEnabled();
  const hasSavedYouTubeLessons =
    youtubeLessonCount != null && youtubeLessonCount > 0;
  const youtubeEnabled =
    config.features.youtubeLearning &&
    (youtubeServerEnabled || hasSavedYouTubeLessons);

  // SETE-283 (HVB-01, HVB-01E, HVB-02): the video cell has a real,
  // data-driven destination. Saved lessons → History, empty store → Input,
  // and a failed read → History as well — History owns the error + retry
  // state, so a failure is never silently treated as "no lessons yet".
  // Single hop, never through CreateMain or Lessons.
  // SETE-289: History is a RootStack route above the tabs; the empty-store
  // branch keeps the Create > YouTubeInput (fromHome) destination.
  const openVideoCell = () => {
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
  };
  const exploreCells: ExploreCell[] = [
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
  ];

  // "Tiếp tục học" rail: the started lesson first, then personal and
  // packaged candidates, deduplicated by id.
  // LING-41 TASK-006: in canonical mode the rail is one flat list of
  // backend summaries (same account on two sessions sees the same
  // dataset) and every item opens the canonical player. Capability
  // failure falls through to the legacy composition (rollback path).
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

  const openRecentItem = (item: RecentItem) => {
    if (item.kind === 'canonical') {
      trackEvent('unified_lesson_opened', {
        lesson_id: item.id,
        source: 'home_rail',
      });
      navigation.navigate('CurriculumLesson', {lessonId: item.id});
      return;
    }
    navigation.navigate('ContentLessonRuntime', {lessonId: item.id});
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <View style={styles.greeting} testID="home-greeting">
          <AppText variant="h3" numberOfLines={1}>
            {t('home.greeting_top')}
          </AppText>
        </View>
        <StreakPill count={streak} />
        <IconButton
          accessibilityLabel={t('home.settings_a11y')}
          icon="settings"
          onPress={() => tabNavigation?.navigate('Profile')}
          testID="home-settings"
          tone="surface"
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: feedClearance},
        ]}
        showsVerticalScrollIndicator={false}
      >
        {showStarter ? (
          <View
            style={styles.heroCard}
            testID="home-starter-section"
            accessibilityRole="none"
          >
            <HeroDecor />
            <View style={styles.heroCopy} testID="home-hero-section">
              <View style={styles.heroBadge}>
                <AppText variant="label" style={styles.heroBadgeLabel}>
                  {t('home.greeting_top')}
                </AppText>
              </View>
              <AppText variant="h3" style={styles.heroTitle} numberOfLines={2}>
                {starterBare
                  ? t('home.empty_title')
                  : heroPick
                  ? t('home.starter_pick')
                  : t('home.starter_title')}
              </AppText>
              <AppText variant="caption" style={styles.heroBody}>
                {starterBare
                  ? t('home.empty_body')
                  : heroPick && libraryCount !== null
                  ? t('home.starter_pick_meta', {n: libraryCount})
                  : t('home.starter_create_meta')}
              </AppText>
              {starterBare ? (
                <HeroCta
                  accessibilityLabel={t('home.empty_create_a11y')}
                  label={t('home.empty_create')}
                  onPress={() => tabNavigation?.navigate('Create')}
                  testID="home-starter-first"
                />
              ) : heroPick ? (
                <HeroCta
                  accessibilityLabel={t('home.starter_pick')}
                  label={t('home.starter_pick')}
                  onPress={() =>
                    tabNavigation?.navigate('Lessons', {
                      screen: 'ContentLessonList',
                    })
                  }
                  testID="home-starter-pick"
                />
              ) : (
                <HeroCta
                  accessibilityLabel={`${t('home.starter_create')}. ${t(
                    'home.starter_create_meta',
                  )}`}
                  label={t('home.starter_create')}
                  onPress={() => tabNavigation?.navigate('Create')}
                  testID="home-starter-create"
                />
              )}
            </View>
            <HeroMascot />
          </View>
        ) : null}
        {startedLesson ? (
          <View style={styles.heroCard} testID="home-continue-section">
            <HeroDecor />
            <View style={styles.heroCopy} testID="home-hero-section">
              <View style={styles.heroBadge}>
                <AppText variant="label" style={styles.heroBadgeLabel}>
                  {t('home.continue_label')}
                </AppText>
              </View>
              <AppText variant="h3" style={styles.heroTitle} numberOfLines={2}>
                {startedLesson.titleVi}
              </AppText>
              <AppText variant="caption" style={styles.heroBody}>
                {t('home.continue_meta', {
                  duration: startedLesson.estimatedDurationMinutes,
                })}
              </AppText>
              <HeroCta
                accessibilityLabel={t('home.continue_learning_a11y')}
                label={t('home.continue_learning')}
                onPress={() =>
                  navigation.navigate('ContentLessonRuntime', {
                    lessonId: startedLesson.id,
                  })
                }
                testID="home-continue-action"
              />
            </View>
            <HeroMascot />
          </View>
        ) : null}
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
              // SETE-283 (HVB-03): with the flag off the video cell is
              // disabled with an explanation — never a dead-end route.
              const isVideoCell = cell.testID === 'home-explore-video';
              const isDisabled = isVideoCell && !youtubeEnabled;
              // SETE-311 Option B: badge/tag render only when a real metric
              // exists (today none do) — the rows collapse otherwise.
              const badgeLabel = cell.badgeKey
                ? t(cell.badgeKey, cell.badgeParams)
                : null;
              const tagLabel = cell.tagKey ? t(cell.tagKey) : null;
              const a11yLabel = isDisabled
                ? `${t(cell.titleKey)}. ${t('home.explore_video_unavailable')}`
                : `${t(cell.titleKey)}. ${t(cell.metaKey)}${
                    badgeLabel ? `. ${badgeLabel}` : ''
                  }${tagLabel ? `. ${tagLabel}` : ''}`;
              // Clay depth via the shared ShelfSurface (same pattern as
              // LessonExploreRow): themes without a shelf get height 0 →
              // flat, with the legacy pressed fade.
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
                      <View style={styles.exploreTopRow}>
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
                          <MaterialIcon
                            color={ink}
                            name={cell.icon}
                            size={24}
                          />
                        </ShelfSurface>
                        {badgeLabel ? (
                          <View
                            style={styles.exploreBadge}
                            testID={`${cell.testID}-badge`}
                          >
                            <AppText
                              variant="caption"
                              style={[styles.exploreBadgeLabel, {color: ink}]}
                              numberOfLines={1}
                            >
                              {badgeLabel}
                            </AppText>
                          </View>
                        ) : null}
                      </View>
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
                      <View
                        style={[styles.exploreDivider, {backgroundColor: ink}]}
                      />
                      <View style={styles.exploreFooter}>
                        {tagLabel ? (
                          <View
                            style={styles.exploreTag}
                            testID={`${cell.testID}-tag`}
                          >
                            <AppText
                              variant="caption"
                              style={[styles.exploreTagLabel, {color: ink}]}
                              numberOfLines={1}
                            >
                              {tagLabel}
                            </AppText>
                          </View>
                        ) : (
                          <View style={styles.exploreFooterSpacer} />
                        )}
                        <View
                          accessible={false}
                          importantForAccessibility="no-hide-descendants"
                          style={[styles.exploreArrow, {borderColor: ink}]}
                          testID={`${cell.testID}-arrow`}
                        >
                          <MaterialIcon
                            color={ink}
                            name="chevron_right"
                            size={16}
                          />
                        </View>
                      </View>
                    </ShelfSurface>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.section} testID="home-lessons-section">
          <View style={styles.sectionHeader}>
            <AppText variant="h3" style={styles.sectionTitle}>
              {t('home.continue_rail_title')}
            </AppText>
            {railItems.length > 0 ? (
              <Pressable
                accessibilityLabel={t('home.view_all_a11y')}
                accessibilityRole="button"
                hitSlop={LINK_HIT_SLOP}
                onPress={() => tabNavigation?.navigate('Lessons')}
                style={styles.textLink}
                testID="home-recent-view-all"
              >
                <AppText
                  variant="label"
                  style={styles.textLinkLabel}
                  numberOfLines={1}
                >
                  {t('home.view_all')}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {railItems.length > 0 ? (
            <ScrollView
              horizontal
              contentContainerStyle={styles.railContent}
              showsHorizontalScrollIndicator={false}
              testID="home-continue-rail"
            >
              {railItems.map(item => (
                <Pressable
                  accessibilityLabel={`${item.title}, ${item.meta}`}
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => openRecentItem(item)}
                  testID={`home-recent-item-${item.id}`}
                  style={styles.railCardWrap}
                >
                  {({pressed}) => (
                    <View style={[styles.railCard, pressed && styles.pressed]}>
                      <View style={styles.railThumb}>
                        <MaterialIcon
                          color={theme.colors.primary}
                          name={
                            item.kind === 'personal' ? 'menu_book' : 'article'
                          }
                          size={24}
                        />
                      </View>
                      <View style={styles.railCopy}>
                        {item.level ? (
                          <View style={styles.railTag}>
                            <AppText
                              variant="caption"
                              style={styles.railTagLabel}
                            >
                              {item.level}
                            </AppText>
                          </View>
                        ) : null}
                        <AppText variant="label" numberOfLines={2}>
                          {item.title}
                        </AppText>
                        <AppText
                          color="muted"
                          variant="caption"
                          numberOfLines={1}
                        >
                          {item.meta}
                        </AppText>
                      </View>
                      <MaterialIcon
                        color={theme.colors.text.secondary}
                        name="chevron_right"
                        size={22}
                      />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.lessonsEmpty}>
              <AppText color="secondary">
                {t('home.lessons_empty_lead')}
              </AppText>
              {startedLesson ? (
                <AppButton
                  accessibilityLabel={t('home.empty_create_a11y')}
                  title={t('home.empty_create')}
                  variant="primary-accent"
                  onPress={() => tabNavigation?.navigate('Create')}
                  testID="home-lessons-create"
                  style={styles.fullWidthButton}
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

/**
 * SETE-311 Option B: real-data streak indicator in the Home header. Status
 * only — not pressable in v1 — and hidden entirely when the streak is 0
 * (a "0 day" pill would turn the greeting into a failure reminder).
 */
function StreakPill({count}: {count: number}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  if (count <= 0) return null;
  return (
    <View
      accessibilityLabel={t('home.streak_pill_a11y', {count})}
      accessibilityRole="text"
      style={styles.streakPill}
      testID="home-streak-pill"
    >
      <MaterialIcon
        color={theme.colors.onTertiaryContainer}
        name="local_fire_department"
        size={16}
      />
      <AppText variant="label" style={styles.streakPillLabel} numberOfLines={1}>
        {count}
      </AppText>
    </View>
  );
}

/**
 * CTA drawn on the fixed deep-blue hero surface: yellow background with dark
 * ink (SETE-281 design reference). Fixed colors in every theme — the pairing
 * is contrast-locked in HomeScreenChipContrast.test.tsx.
 */
function HeroCta({
  accessibilityLabel,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        styles.heroCta,
        pressed && {opacity: theme.states.pressedOpacity},
      ]}
    >
      <AppText variant="label" style={styles.heroCtaLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Corner blobs clipped by the hero card (SETE-281 design reference: coral
 * circle top-right, mint blob bottom-left). Purely decorative.
 */
function HeroDecor() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={styles.heroDecor}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.heroBlobCoral} />
      <View style={styles.heroBlobMint} />
    </View>
  );
}

/**
 * Cat mascot (SETE-281 design reference): user-supplied artwork bundled as a
 * transparent PNG. Purely decorative.
 */
function HeroMascot() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={styles.heroMascot}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={require('../../assets/home-hero-cat.png')}
        style={styles.heroMascotImage}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      height: 56,
      justifyContent: 'space-between',
      paddingHorizontal: theme.gutter,
    },
    greeting: {flex: 1, gap: 0, minWidth: 0, paddingRight: theme.spacing.sm},
    streakPill: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      flexShrink: 0,
      gap: 4,
      height: 32,
      paddingHorizontal: 10,
    },
    streakPillLabel: {
      color: theme.colors.onTertiaryContainer,
      fontWeight: '700',
    },
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
    // Lets long AX titles wrap instead of pushing the section link off-screen.
    sectionTitle: {flex: 1, minWidth: 0},
    heroCard: {
      alignItems: 'center',
      backgroundColor: HERO_BLUE,
      borderRadius: theme.radius.xl,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 250,
      overflow: 'hidden',
      padding: theme.spacing.lg,
      ...theme.shadow.soft,
    },
    heroDecor: {
      ...StyleSheet.absoluteFill,
    },
    heroBlobCoral: {
      backgroundColor: HERO_CORAL,
      borderRadius: 60,
      height: 120,
      position: 'absolute',
      right: -40,
      top: -48,
      width: 120,
    },
    heroBlobMint: {
      backgroundColor: HERO_MINT,
      borderRadius: 45,
      bottom: -60,
      height: 90,
      left: -44,
      position: 'absolute',
      width: 80,
    },
    heroCopy: {flex: 1, gap: theme.spacing.sm, minWidth: 0},
    heroBadge: {
      alignSelf: 'flex-start',
      backgroundColor: HERO_BADGE_BG,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
    },
    heroBadgeLabel: {
      color: HERO_BADGE_INK,
    },
    heroTitle: {
      color: HERO_TITLE,
    },
    heroBody: {
      color: HERO_TITLE,
      opacity: 0.92,
    },
    heroMascot: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: -110,
      marginRight: -18,
      width: 128,
    },
    heroMascotImage: {
      height: 140,
      width: 112,
    },
    heroCta: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: HERO_CTA_BG,
      borderRadius: 999,
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
      // Height stays flexible so AX text sizes wrap instead of clipping.
      minHeight: 48,
      minWidth: 160,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    heroCtaLabel: {
      color: HERO_CTA_INK,
      textAlign: 'center',
    },
    fullWidthButton: {
      alignSelf: 'stretch',
      // Height stays flexible so AX text sizes wrap instead of clipping.
      height: 'auto',
      minHeight: 52,
      paddingVertical: theme.spacing.sm,
    },
    lessonsEmpty: {
      gap: theme.spacing.md,
    },
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
      minHeight: 180,
      padding: theme.spacing.md,
    },
    exploreTopRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    exploreBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      height: 22,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.sm,
    },
    exploreBadgeLabel: {},
    exploreDivider: {
      height: 1,
      opacity: 0.1,
    },
    exploreFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    exploreTag: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    exploreTagLabel: {},
    exploreFooterSpacer: {
      flex: 1,
    },
    exploreArrow: {
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      height: 24,
      justifyContent: 'center',
      width: 24,
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
    railContent: {
      gap: theme.spacing.sm,
      paddingRight: theme.gutter,
    },
    railCardWrap: {
      width: 248,
    },
    railCard: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 96,
      padding: theme.spacing.md,
      ...theme.shadow.soft,
    },
    railThumb: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 14,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    railCopy: {flex: 1, gap: 4, minWidth: 0},
    railTag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    railTagLabel: {
      color: theme.colors.primary,
    },
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
