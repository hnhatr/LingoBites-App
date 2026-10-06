import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useMemo} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  listDownloadedLessonSummaries,
  useCanonicalCatalog,
} from '@features/lesson/player';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import type {LessonOrigin, LessonSourceType} from '@core/schemas/lesson';

import {LibraryEmptyState} from './LibraryEmptyState';

export interface PublicLessonsListProps {
  origin: LessonOrigin;
  sourceType: LessonSourceType;
  /** Client-side search over the loaded lessons' title and description. */
  searchQuery?: string;
}

/**
 * Lessons everyone can see, listed from the server catalog (needs a
 * connection). A lesson already on this phone is marked "Đã tải".
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

  const downloadedIds = useMemo(
    () =>
      // Skip the local read while the catalog is still loading, so opening
      // the list is not held up by it.
      state.status === 'ready'
        ? new Set(listDownloadedLessonSummaries().map(item => item.lessonId))
        : new Set<string>(),
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
      renderItem={({item}) => (
        <Pressable
          accessibilityHint="Mở bài học"
          accessibilityLabel={item.title}
          accessibilityRole="button"
          onPress={() => navigation.openLesson(item.id)}
          testID={`public-lesson-${item.id}`}
        >
          <AppCard>
            <View style={styles.card}>
              <AppText variant="h3">{item.title}</AppText>
              {item.description.trim().length > 0 ? (
                <AppText
                  color="secondary"
                  ellipsizeMode="tail"
                  numberOfLines={2}
                  variant="label"
                >
                  {item.description}
                </AppText>
              ) : null}
              <View style={styles.chips}>
                {item.unit ? (
                  <Chip label={item.unit.level_title} tone="gold" />
                ) : null}
                <Chip label={`${item.sentence_count} câu`} tone="neutral" />
                {downloadedIds.has(item.id) ? (
                  <Chip label="Đã tải" tone="accentSoft" />
                ) : null}
              </View>
            </View>
          </AppCard>
        </Pressable>
      )}
    />
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
    card: {
      gap: theme.spacing.xs,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
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
