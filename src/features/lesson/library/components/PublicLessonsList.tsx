import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useMemo} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';

import {useCanonicalCatalog} from '@features/lesson/player';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  lessonCardDurationLabel,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {cardToneAt, ToneCard} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import type {
  LessonCatalogItem,
  LessonCatalogKind,
  LessonOrigin,
  LessonSourceType,
} from '@core/schemas/lesson';

import {catalogCoverUrl} from '../logic/catalogCover';
import {
  EMPTY_LESSON_CARD_STATE,
  lessonContextLabel,
  readLessonCardLocalState,
  useLessonBookmarks,
} from '../logic/lessonCardData';
import {LibraryEmptyState} from './LibraryEmptyState';
import {createdAction, createdProgressLabel} from './tabs/CreatedTab';

export interface PublicLessonsListProps {
  origin: LessonOrigin;
  sourceType: LessonSourceType;
  /** `video`: public videos, each card naming its six-step lessons. */
  kind?: LessonCatalogKind;
  /** Client-side search over the loaded lessons' title and description. */
  searchQuery?: string;
}

/**
 * Lessons everyone can see, listed from the server catalog (needs a
 * connection), as the shared lesson card: a lesson already on this phone is
 * marked "Đã tải", and each card can be saved for later.
 */
export function PublicLessonsList({
  origin,
  sourceType,
  kind,
  searchQuery = '',
}: PublicLessonsListProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const navigation = useAppNavigation();
  const {state, refresh, loadMore} = useCanonicalCatalog({
    origin,
    sourceType,
    kind,
  });

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const {isBookmarked, toggleBookmark} = useLessonBookmarks();
  const localState = useMemo(
    () =>
      // Skip the local read while the catalog is still loading, so opening
      // the list is not held up by it.
      state.status === 'ready'
        ? readLessonCardLocalState()
        : EMPTY_LESSON_CARD_STATE,
    // Re-read once the catalog has (re)loaded: a lesson may have been saved.
    [state.status],
  );

  const query = searchQuery.trim().toLowerCase();
  const lessons = useMemo(() => {
    if (state.status !== 'ready') {
      return [];
    }
    if (!query) {
      return state.lessons;
    }
    return state.lessons.filter(
      lesson =>
        lesson.title.toLowerCase().includes(query) ||
        lesson.description.toLowerCase().includes(query),
    );
  }, [state, query]);

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <ActivityIndicator
        color={theme.colors.primary}
        style={styles.loading}
        testID="public-lessons-loading"
      />
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.errorBox}>
        <AppText color="danger" testID="public-lessons-error">
          Không tải được danh sách. Kiểm tra kết nối mạng rồi thử lại.
        </AppText>
        <AppButton
          accessibilityHint="Tải lại danh sách bài công khai"
          onPress={refresh}
          testID="public-lessons-retry"
          title="Thử lại"
          variant="secondary"
        />
      </View>
    );
  }

  if (lessons.length === 0) {
    return <LibraryEmptyState type={query ? 'no-results' : 'public'} />;
  }

  return (
    <FlatList
      contentContainerStyle={[styles.list, {paddingBottom: feedClearance}]}
      data={lessons}
      keyExtractor={item => item.id}
      onEndReached={state.nextCursor ? loadMore : undefined}
      onEndReachedThreshold={0.4}
      testID="public-lessons-list"
      ListHeaderComponent={
        state.offline ? (
          <AppText
            color="secondary"
            variant="caption"
            testID="public-lessons-offline"
          >
            Đang offline — chỉ hiện các bài đã có trên máy.
          </AppText>
        ) : null
      }
      ListFooterComponent={
        state.loadingMore ? (
          <ActivityIndicator
            color={theme.colors.primary}
            testID="public-lessons-loading-more"
          />
        ) : null
      }
      renderItem={({item, index}) => {
        const contextLabel =
          kind === 'video'
            ? videoContextLabel(item)
            : lessonContextLabel(item.unit);
        const durationLabel = lessonCardDurationLabel({
          estimatedMinutes: item.estimated_minutes,
          youtubeDurationMs: item.youtube_duration_ms,
          sentenceCount: item.sentence_count,
        });
        const progress = localState.progress.get(item.id);
        return (
          <ToneCard
            accessibilityHint={kind === 'video' ? 'Mở video' : 'Mở bài học'}
            action={
              kind === 'video' && !progress
                ? {label: 'Xem', glyph: 'play', solid: true}
                : createdAction(progress)
            }
            bookmark={{
              saved: isBookmarked(item.id),
              onToggle: () =>
                toggleBookmark({
                  lessonId: item.id,
                  title: item.title,
                  sourceType: item.source_type,
                  sentenceCount: item.sentence_count,
                  estimatedMinutes: item.estimated_minutes ?? null,
                  contextLabel,
                }),
            }}
            cover={{
              imageUrl: catalogCoverUrl(item),
              glyph: kind === 'video' ? 'subtitles' : 'book',
            }}
            description={[
              durationLabel,
              item.cefr_level,
              localState.downloadedIds.has(item.id) ? 'Đã tải' : null,
              createdProgressLabel(progress),
            ]
              .filter(Boolean)
              .join(' · ')}
            eyebrow={contextLabel}
            gutter={theme.gutter}
            onPress={() => navigation.openLesson(item.id)}
            testID={`public-lesson-${item.id}`}
            title={splitLessonTitle(item.title).title}
            tone={cardToneAt(index)}
          />
        );
      }}
    />
  );
}

/** A public video card says how many six-step lessons it has. */
export function videoContextLabel(item: LessonCatalogItem): string {
  const count = item.video_lesson_count ?? 0;
  return count > 0 ? `Video · ${count} bài học` : 'Video';
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
    loading: {
      marginTop: theme.spacing.xl,
    },
    errorBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      margin: theme.gutter,
      padding: theme.spacing.lg,
    },
  });
}
