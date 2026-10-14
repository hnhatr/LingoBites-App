import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {useCanonicalCatalog} from '@features/lesson/player';
import {type PackRow, packTitle, useWordPathRows} from '@features/wordPath';

import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  formatVideoDuration,
  lessonCardDurationLabel,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {topicGlyph} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import type {LessonCatalogItem} from '@core/schemas/lesson';

import {catalogCoverUrl} from '../../logic/catalogCover';
import {
  getLibrarySection,
  type LibrarySectionConfig,
} from '../../logic/librarySections';
import {useRefreshOnRefocus} from '../../logic/useLibrarySegments';
import {
  LessonRowCard,
  PackCard,
  UnitHeading,
  VideoHeroCard,
  VideoRowCard,
} from '../ExploreCards';
import {LibraryShelf, type ShelfStatus} from '../LibraryShelf';
import {libraryTone, PACK_TONES} from '../libraryTones';
import {videoContextLabel} from '../PublicLessonsList';

/** How many packs the folder shows (two rows of two) before "Xem cả". */
export const SHELF_LIMIT = 4;
/** How many videos: one large, then a short list. */
export const VIDEO_LIMIT = 3;
/** How many public lessons the contents list shows. */
export const LESSON_LIMIT = 5;

const PUBLIC_LESSONS = getLibrarySection('public');
const PUBLIC_VIDEOS = getLibrarySection('publicVideo');

const PACK_ORDER: Record<PackRow['status'], number> = {
  learning: 0,
  ready: 1,
  not_downloaded: 2,
  done: 3,
};

/** Packs being learned first, then downloaded ones, then the rest. */
export function shelfPacks(rows: readonly PackRow[]): PackRow[] {
  return [...rows]
    .sort((a, b) => PACK_ORDER[a.status] - PACK_ORDER[b.status])
    .slice(0, SHELF_LIMIT);
}

/**
 * "Khám phá": what LingoBites provides, as shelves of word packs, public
 * videos and public lessons. Packs on the phone still show offline.
 */
export function ExploreTab() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const feedClearance = useFloatingTabBarClearance();
  const appNavigation = useAppNavigation();
  const packs = useWordPathRows();
  const offlineTone = libraryTone(theme, 'yellow');

  useRefreshOnRefocus(packs.reload);

  const packStatus: ShelfStatus | null =
    packs.rows === null
      ? {kind: 'loading'}
      : packs.rows.length === 0
        ? {
            kind: 'message',
            text: packs.offline ? 'Cần mạng để xem gói học' : 'Chưa có gói học',
            onRetry: packs.offline ? packs.reload : undefined,
          }
        : null;
  const packCount = packs.rows?.length ?? 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
      testID="library-explore-tab"
    >
      {packs.offline ? (
        <View style={[styles.offline, {backgroundColor: offlineTone.soft}]}>
          <MaterialIcon
            color={theme.colors.text.secondary}
            name="warning"
            size={18}
          />
          <AppText
            color="secondary"
            style={styles.offlineText}
            testID="library-explore-offline"
          >
            Đang offline: chỉ hiện những gì đã có trên máy.
          </AppText>
        </View>
      ) : null}
      <LibraryShelf
        count={packCount > 0 ? String(packCount) : null}
        icon="style"
        label="Gói học"
        onSeeAll={() => appNavigation.openLibrarySection('wordPath')}
        seeAllLabel={`Xem cả ${packCount} gói`}
        status={packStatus}
        subtitle="Học theo chủ đề, tải về để học offline"
        testID="library-shelf-packs"
        title="Gói từ vựng"
        tone="teal"
      >
        <TwoColumns>
          {shelfPacks(packs.rows ?? []).map(row => (
            <PackCard
              accessibilityHint={
                row.downloaded
                  ? t('wordPath.open_hint')
                  : 'Mở danh sách gói để tải về'
              }
              downloaded={row.downloaded}
              glyph={topicGlyph(row.topicCode)}
              imageUrl={row.coverUrl}
              key={row.packId}
              learned={row.learned}
              level={row.level}
              onPress={() =>
                row.downloaded
                  ? appNavigation.openWordPack(row.packId)
                  : appNavigation.openLibrarySection('wordPath')
              }
              sizeLabel={`${row.total} từ`}
              statusLabel={packStatusLabel(t, row)}
              testID={`library-pack-${row.packId}`}
              title={packTitle(t, row)}
              tone={
                PACK_TONES[
                  (row.position - 1 + PACK_TONES.length) % PACK_TONES.length
                ]
              }
              total={row.total}
            />
          ))}
        </TwoColumns>
      </LibraryShelf>
      <VideoShelf />
      <LessonShelf />
    </ScrollView>
  );
}

/** "4/12 đã nhớ", "Đã tải, chưa học" or "Chưa tải" under a pack. */
function packStatusLabel(
  t: ReturnType<typeof useTranslation>['t'],
  row: PackRow,
): string {
  if (!row.downloaded) return t('wordPath.status_not_downloaded');
  if (row.learned === 0) return 'Đã tải, chưa học';
  return t('wordPath.learned_of', {learned: row.learned, total: row.total});
}

/** Lays children out two to a row; an odd last one keeps its width. */
function TwoColumns({children}: {children: React.ReactNode}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const items = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];
  for (let at = 0; at < items.length; at += 2) {
    rows.push(items.slice(at, at + 2));
  }
  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.gridRow}>
          {row}
          {row.length === 1 ? <View style={styles.gridSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Folder state for a catalog query: spinner, error, empty or none. */
function catalogStatus(
  state: ReturnType<typeof useCanonicalCatalog>['state'],
  refresh: () => void,
  emptyHint: string,
): ShelfStatus | null {
  return state.status === 'idle' || state.status === 'loading'
    ? {kind: 'loading'}
    : state.status === 'error'
      ? {kind: 'message', text: 'Cần mạng để xem', onRetry: refresh}
      : state.lessons.length === 0
        ? {kind: 'message', text: emptyHint}
        : null;
}

/** "20" or "20+" when the server has more than the first page. */
function catalogCount(
  state: ReturnType<typeof useCanonicalCatalog>['state'],
): string | null {
  if (state.status !== 'ready' || state.lessons.length === 0) return null;
  return `${state.lessons.length}${state.nextCursor ? '+' : ''}`;
}

function useSectionCatalog(section: LibrarySectionConfig) {
  const catalog = useCanonicalCatalog({
    origin: section.catalog?.origin,
    sourceType: section.catalog?.sourceType,
    kind: section.catalog?.kind,
  });
  const {refresh} = catalog;
  useEffect(() => {
    refresh();
  }, [refresh]);
  return catalog;
}

/** Public videos: the first one large, the next ones as a list. */
function VideoShelf() {
  const testID = 'library-shelf-videos';
  const appNavigation = useAppNavigation();
  const {state, refresh} = useSectionCatalog(PUBLIC_VIDEOS);
  const count = catalogCount(state);
  const videos =
    state.status === 'ready' ? state.lessons.slice(0, VIDEO_LIMIT) : [];

  const cardProps = (item: LessonCatalogItem) => ({
    cover: {
      imageUrl: catalogCoverUrl(item),
      level: item.cefr_level,
      duration: item.youtube_duration_ms
        ? formatVideoDuration(item.youtube_duration_ms)
        : null,
    },
    meta: videoContextLabel(item),
    onPress: () => appNavigation.openLesson(item.id),
    testID: `${testID}-${item.id}`,
    title: splitLessonTitle(item.title).title,
  });

  return (
    <LibraryShelf
      count={count}
      icon="subtitles"
      label="Video"
      onSeeAll={() => appNavigation.openLibrarySection(PUBLIC_VIDEOS.id)}
      seeAllLabel={count ? `Xem cả ${count} video` : 'Xem tất cả video'}
      status={catalogStatus(state, refresh, PUBLIC_VIDEOS.emptyHint)}
      subtitle={PUBLIC_VIDEOS.description}
      testID={testID}
      title="Xem & học"
      tone="coral"
    >
      {videos.map((item, index) =>
        index === 0 ? (
          <VideoHeroCard key={item.id} {...cardProps(item)} />
        ) : (
          <VideoRowCard key={item.id} {...cardProps(item)} />
        ),
      )}
    </LibraryShelf>
  );
}

/** Public lessons as a contents page, grouped under their unit. */
function LessonShelf() {
  const testID = 'library-shelf-lessons';
  const appNavigation = useAppNavigation();
  const {state, refresh} = useSectionCatalog(PUBLIC_LESSONS);
  const count = catalogCount(state);
  const groups = groupByUnit(
    state.status === 'ready' ? state.lessons.slice(0, LESSON_LIMIT) : [],
  );

  return (
    <LibraryShelf
      count={count}
      icon="menu_book"
      label="Bài học"
      onSeeAll={() => appNavigation.openLibrarySection(PUBLIC_LESSONS.id)}
      seeAllLabel={count ? `Xem cả ${count} bài` : 'Xem tất cả bài học'}
      status={catalogStatus(state, refresh, PUBLIC_LESSONS.emptyHint)}
      subtitle={PUBLIC_LESSONS.description}
      testID={testID}
      title="Bài theo chủ đề"
      tone="yellow"
    >
      {groups.map(group => (
        <React.Fragment key={group.key}>
          {group.title ? <UnitHeading title={group.title} /> : null}
          {group.items.map((item, index) => (
            <LessonRowCard
              index={String(item.unit?.lesson_position ?? index + 1).padStart(
                2,
                '0',
              )}
              key={item.id}
              level={item.cefr_level ?? null}
              meta={lessonMeta(item)}
              onPress={() => appNavigation.openLesson(item.id)}
              testID={`${testID}-${item.id}`}
              title={splitLessonTitle(item.title).title}
            />
          ))}
        </React.Fragment>
      ))}
    </LibraryShelf>
  );
}

interface UnitGroup {
  key: string;
  unitId: string | null;
  title: string | null;
  items: LessonCatalogItem[];
}

/** Neighbouring lessons of the same unit, in catalog order. */
export function groupByUnit(items: readonly LessonCatalogItem[]): UnitGroup[] {
  const groups: UnitGroup[] = [];
  items.forEach(item => {
    const unitId = item.unit?.unit_id ?? null;
    const last = groups[groups.length - 1];
    if (last && last.unitId === unitId) {
      last.items.push(item);
      return;
    }
    groups.push({
      key: unitId ?? `none-${groups.length}`,
      unitId,
      title: item.unit?.unit_title ?? null,
      items: [item],
    });
  });
  return groups;
}

/** "10 phút · 12 câu" on a lesson row. */
function lessonMeta(item: LessonCatalogItem): string | null {
  const duration = lessonCardDurationLabel({
    estimatedMinutes: item.estimated_minutes,
    youtubeDurationMs: item.youtube_duration_ms,
    sentenceCount: item.sentence_count,
  });
  const sentences =
    item.sentence_count > 0 ? `${item.sentence_count} câu` : null;
  return [duration, sentences].filter(Boolean).join(' · ') || null;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    offline: {
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    offlineText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
    },
    grid: {
      gap: theme.spacing.lg,
    },
    gridRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    gridSpacer: {
      flex: 1,
    },
  });
}
