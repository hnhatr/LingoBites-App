import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

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
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import type {LessonCatalogItem} from '@core/schemas/lesson';

import {catalogCoverUrl} from '../../logic/catalogCover';
import {
  getLibrarySection,
  type LibrarySectionConfig,
} from '../../logic/librarySections';
import {useRefreshOnRefocus} from '../../logic/useLibrarySegments';
import {LibraryShelf, ShelfCard, type ShelfStatus} from '../LibraryShelf';
import {videoContextLabel} from '../PublicLessonsList';

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
        icon="style"
        onSeeAll={() => appNavigation.openLibrarySection('wordPath')}
        status={packStatus}
        testID="library-shelf-packs"
        title="Gói học"
      >
        {shelfPacks(packs.rows ?? []).map(row => (
          <ShelfCard
            accessibilityHint={
              row.downloaded
                ? t('wordPath.open_hint')
                : 'Mở danh sách gói để tải về'
            }
            cover={{
              shape: 'pack',
              imageUrl: row.coverUrl,
              level: row.level,
              glyph: topicGlyph(row.topicCode),
              badge: row.downloaded ? 'check' : 'download',
            }}
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
            sub={
              row.topic
                ? `${t('wordPath.pack_title', {position: row.position})} · ${
                    row.total
                  } từ`
                : `${row.total} từ`
            }
            testID={`library-pack-${row.packId}`}
            title={packTitle(t, row)}
            titleLines={1}
            width={PACK_WIDTH}
          />
        ))}
      </LibraryShelf>
      <CatalogShelf
        section={PUBLIC_VIDEOS}
        testID="library-shelf-videos"
        title="Video"
      />
      <CatalogShelf
        section={PUBLIC_LESSONS}
        testID="library-shelf-lessons"
        title="Bài học"
      />
    </ScrollView>
  );
}

const PACK_WIDTH = 148;
const VIDEO_WIDTH = 232;
const LESSON_WIDTH = 176;

interface CatalogShelfProps {
  section: LibrarySectionConfig;
  title: string;
  testID: string;
}

/** A shelf of public lessons or videos from the server catalog. */
function CatalogShelf({section, title, testID}: CatalogShelfProps) {
  const isVideo = section.catalog?.kind === 'video';
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
      icon={isVideo ? 'subtitles' : 'menu_book'}
      onSeeAll={() => appNavigation.openLibrarySection(section.id)}
      status={status}
      testID={testID}
      title={title}
    >
      {state.status === 'ready'
        ? state.lessons.slice(0, SHELF_LIMIT).map(item =>
            isVideo ? (
              <ShelfCard
                accessibilityHint="Mở video"
                cover={{
                  shape: 'video',
                  imageUrl: catalogCoverUrl(item),
                  level: item.cefr_level,
                  glyph: 'subtitles',
                  play: true,
                  duration: item.youtube_duration_ms
                    ? formatVideoDuration(item.youtube_duration_ms)
                    : null,
                }}
                key={item.id}
                meta={videoContextLabel(item)}
                metaIcon="menu_book"
                onPress={() => appNavigation.openLesson(item.id)}
                testID={`${testID}-${item.id}`}
                title={splitLessonTitle(item.title).title}
                width={VIDEO_WIDTH}
              />
            ) : (
              <ShelfCard
                accessibilityHint="Mở bài học"
                cover={{
                  shape: 'lesson',
                  imageUrl: catalogCoverUrl(item),
                  level: item.cefr_level,
                  glyph: 'book',
                  tag: item.unit?.unit_title ?? null,
                }}
                key={item.id}
                meta={lessonMeta(item)}
                metaIcon="schedule"
                onPress={() => appNavigation.openLesson(item.id)}
                testID={`${testID}-${item.id}`}
                title={splitLessonTitle(item.title).title}
                width={LESSON_WIDTH}
              />
            ),
          )
        : null}
    </LibraryShelf>
  );
}

/** "10 phút · 12 câu" on a lesson card. */
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
      paddingTop: theme.spacing.md,
    },
    offline: {
      paddingHorizontal: theme.gutter,
    },
  });
}
