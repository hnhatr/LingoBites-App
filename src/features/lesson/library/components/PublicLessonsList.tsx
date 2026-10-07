import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useMemo} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';

import {useCanonicalCatalog} from '@features/lesson/player';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  LessonCard,
  lessonCardDurationLabel,
  lessonCardKind,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import type {LessonOrigin, LessonSourceType} from '@core/schemas/lesson';

import {
  EMPTY_LESSON_CARD_STATE,
  lessonContextLabel,
  readLessonCardLocalState,
  useLessonBookmarks,
} from '../logic/lessonCardData';
import {LibraryEmptyState} from './LibraryEmptyState';

export interface PublicLessonsListProps {
  origin: LessonOrigin;
  sourceType: LessonSourceType;
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
  searchQuery = '',
}: PublicLessonsListProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const navigation = useAppNavigation();
  const {state, refresh, loadMore} = useCanonicalCatalog({origin, sourceType});

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
      ListFooterComponent={
        state.loadingMore ? (
          <ActivityIndicator
            color={theme.colors.primary}
            testID="public-lessons-loading-more"
          />
        ) : null
      }
      renderItem={({item}) => {
        const {title, subtitle} = splitLessonTitle(item.title);
        const contextLabel = lessonContextLabel(item.unit);
        const durationLabel = lessonCardDurationLabel({
          estimatedMinutes: item.estimated_minutes,
          youtubeDurationMs: item.youtube_duration_ms,
          sentenceCount: item.sentence_count,
        });
        return (
          <LessonCard
            accessibilityHint="Mở bài học"
            bookmarked={isBookmarked(item.id)}
            context={contextLabel}
            downloaded={localState.downloadedIds.has(item.id)}
            durationLabel={durationLabel}
            exerciseCount={
              item.activity_count ?? localState.activityCounts.get(item.id)
            }
            kind={lessonCardKind(item.source_type)}
            onPress={() => navigation.openLesson(item.id)}
            onToggleBookmark={() =>
              toggleBookmark({
                lessonId: item.id,
                title: item.title,
                sourceType: item.source_type,
                sentenceCount: item.sentence_count,
                estimatedMinutes: item.estimated_minutes ?? null,
                contextLabel,
              })
            }
            progress={localState.progress.get(item.id)}
            sentenceCount={item.sentence_count}
            subtitle={subtitle}
            testID={`public-lesson-${item.id}`}
            title={title}
          />
        );
      }}
    />
  );
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
