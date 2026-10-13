import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

import {useCanonicalCatalog} from '@features/lesson/player';
import {type PackRow, packTitle, useWordPathRows} from '@features/wordPath';

import {AppText} from '@ui/components/AppText';
import {gridTileToneAt} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  lessonCardDurationLabel,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
  getLibrarySection,
  type LibrarySectionConfig,
} from '../../logic/librarySections';
import {useRefreshOnRefocus} from '../../logic/useLibrarySegments';
import {LibraryShelf, ShelfCard, type ShelfStatus} from '../LibraryShelf';

/** How many cards a shelf shows before "Tất cả". */
export const SHELF_LIMIT = 10;

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

  return (
    <ScrollView
      contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
      testID="library-explore-tab"
    >
      {packs.offline ? (
        <AppText
          color="secondary"
          style={styles.offline}
          testID="library-explore-offline"
          variant="caption"
        >
          Đang offline: chỉ hiện những gì đã có trên máy.
        </AppText>
      ) : null}
      <LibraryShelf
        onSeeAll={() => appNavigation.openLibrarySection('wordPath')}
        status={packStatus}
        testID="library-shelf-packs"
        title="Gói học"
      >
        {shelfPacks(packs.rows ?? []).map((row, index) => (
          <ShelfCard
            accessibilityHint={
              row.downloaded
                ? t('wordPath.open_hint')
                : 'Mở danh sách gói để tải về'
            }
            badge={row.downloaded ? 'check_circle' : undefined}
            coverLabel={row.level}
            icon="style"
            key={row.packId}
            meta={
              row.downloaded
                ? t('wordPath.learned_of', {
                    learned: row.learned,
                    total: row.total,
                  })
                : t('wordPath.status_not_downloaded')
            }
            onPress={() =>
              row.downloaded
                ? appNavigation.openWordPack(row.packId)
                : appNavigation.openLibrarySection('wordPath')
            }
            progress={
              row.downloaded && row.total > 0
                ? row.learned / row.total
                : undefined
            }
            testID={`library-pack-${row.packId}`}
            title={packTitle(t, row)}
            tone={gridTileToneAt(index)}
            width={116}
          />
        ))}
      </LibraryShelf>
      <CatalogShelf
        icon="subtitles"
        section={PUBLIC_VIDEOS}
        testID="library-shelf-videos"
        title="Video"
        width={156}
      />
      <CatalogShelf
        icon="auto_stories"
        section={PUBLIC_LESSONS}
        testID="library-shelf-lessons"
        title="Bài học"
      />
    </ScrollView>
  );
}

interface CatalogShelfProps {
  section: LibrarySectionConfig;
  title: string;
  icon: 'subtitles' | 'auto_stories';
  width?: number;
  testID: string;
}

/** A shelf of public lessons or videos from the server catalog. */
function CatalogShelf({
  section,
  title,
  icon,
  width,
  testID,
}: CatalogShelfProps) {
  const appNavigation = useAppNavigation();
  const {state, refresh} = useCanonicalCatalog({
    origin: section.catalog?.origin,
    sourceType: section.catalog?.sourceType,
    kind: section.catalog?.kind,
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const status: ShelfStatus | null =
    state.status === 'idle' || state.status === 'loading'
      ? {kind: 'loading'}
      : state.status === 'error'
      ? {kind: 'message', text: 'Cần mạng để xem', onRetry: refresh}
      : state.lessons.length === 0
      ? {kind: 'message', text: section.emptyHint}
      : null;

  return (
    <LibraryShelf
      onSeeAll={() => appNavigation.openLibrarySection(section.id)}
      status={status}
      testID={testID}
      title={title}
    >
      {state.status === 'ready'
        ? state.lessons.slice(0, SHELF_LIMIT).map((item, index) => (
            <ShelfCard
              accessibilityHint={
                section.catalog?.kind === 'video' ? 'Mở video' : 'Mở bài học'
              }
              icon={icon}
              key={item.id}
              meta={lessonCardDurationLabel({
                estimatedMinutes: item.estimated_minutes,
                youtubeDurationMs: item.youtube_duration_ms,
                sentenceCount: item.sentence_count,
              })}
              onPress={() => appNavigation.openLesson(item.id)}
              testID={`${testID}-${item.id}`}
              title={splitLessonTitle(item.title).title}
              tone={gridTileToneAt(index + 1)}
              width={width}
            />
          ))
        : null}
    </LibraryShelf>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
      paddingTop: theme.spacing.md,
    },
    offline: {
      paddingHorizontal: theme.gutter,
    },
  });
}
