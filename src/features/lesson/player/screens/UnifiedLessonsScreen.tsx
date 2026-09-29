/**
 * Unified lesson catalog: one flat server-driven lesson list.
 *
 * In unified mode the app renders canonical summaries from
 * `GET /api/v1/lessons` with no `personal`/`personal_v2`/`packaged`
 * sections, badges, or routing kinds. Every item opens the same
 * canonical `CurriculumLesson({lessonId})` route. Local package
 * bootstrap is never triggered from this path.
 */
import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useMemo} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Medallion} from '@ui/components/Medallion';
import {trackEvent} from '@features/analytics';
import {useFloatingTabBarClearance} from '@ui/components/layout/index';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import {
  useLessonCatalog,
  type UseLessonCatalogResult,
} from '../logic/useLessonCatalog';
import type {UnifiedLessonSummary} from '../logic/lessonCatalogClient';

export interface UnifiedLessonsRouteScreenProps {
  navigation: {
    navigate: (screen: 'CurriculumLesson', params: {lessonId: string}) => void;
  };
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
    pressable: {
      flex: 1,
    },
    cardContent: {
      gap: theme.spacing.xs,
    },
    lessonTitle: {
      marginBottom: theme.spacing.xs,
    },
    center: {
      alignItems: 'center',
      flex: 1,
      gap: theme.spacing.md,
      justifyContent: 'center',
      padding: theme.gutter,
    },
    emptyWrap: {
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    emptyMessage: {
      textAlign: 'center',
    },
    errorTitle: {
      textAlign: 'center',
    },
    footer: {
      paddingVertical: theme.spacing.md,
    },
  });
}

export type UnifiedLessonCatalogViewProps = {
  items: UnifiedLessonSummary[];
  hasMore: boolean;
  refreshing: boolean;
  onOpenLesson: (lessonId: string) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
};

export function UnifiedLessonCatalogView({
  items,
  hasMore,
  refreshing,
  onOpenLesson,
  onLoadMore,
  onRefresh,
}: UnifiedLessonCatalogViewProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();

  if (items.length === 0) {
    return (
      <View style={styles.center} testID="unified-lessons-empty">
        <View style={styles.emptyWrap}>
          <Medallion label="📖" />
          <AppText
            variant="body"
            color="secondary"
            style={styles.emptyMessage}
            testID="unified-lessons-empty-message"
          >
            Chưa có bài học nào
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.contentContainer,
          {paddingBottom: feedClearance},
        ]}
        onEndReached={hasMore ? onLoadMore : null}
        onEndReachedThreshold={0.5}
        testID="unified-lessons-list"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            testID="unified-lessons-refresh"
          />
        }
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footer} testID="unified-lessons-more">
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : null
        }
        renderItem={({item}) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint="Lesson. Opens the guided lesson."
            onPress={() => onOpenLesson(item.id)}
            testID={`unified-lesson-item-${item.id}`}
            style={styles.pressable}
          >
            <AppCard>
              <View style={styles.cardContent}>
                <AppText
                  variant="h3"
                  style={styles.lessonTitle}
                  testID={`unified-lesson-title-${item.id}`}
                >
                  {item.title}
                </AppText>
                {item.description ? (
                  <AppText
                    variant="label"
                    color="secondary"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    testID={`unified-lesson-summary-${item.id}`}
                  >
                    {item.description}
                  </AppText>
                ) : null}
                {item.estimatedMinutes != null ? (
                  <AppText
                    variant="caption"
                    color="secondary"
                    testID={`unified-lesson-meta-${item.id}`}
                  >
                    {`${item.estimatedMinutes} min`}
                  </AppText>
                ) : null}
              </View>
            </AppCard>
          </Pressable>
        )}
      />
    </View>
  );
}

type UnifiedLessonsScreenProps = {
  catalog?: UseLessonCatalogResult;
  onOpenLesson?: (lessonId: string) => void;
};

/**
 * Unified lessons tab content. Data-driven via `useLessonCatalog`;
 * refreshes whenever the tab regains focus. A test-provided `catalog`
 * result overrides the live hook.
 */
export function UnifiedLessonsScreen({
  catalog: catalogOverride,
  onOpenLesson,
}: UnifiedLessonsScreenProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const liveCatalog = useLessonCatalog({enabled: catalogOverride == null});
  const catalog = catalogOverride ?? liveCatalog;
  const catalogOpenedRef = React.useRef(false);

  const refreshCatalog = catalog.refresh;
  useFocusEffect(
    useCallback(() => {
      if (catalogOverride == null) {
        refreshCatalog();
      }
    }, [catalogOverride, refreshCatalog]),
  );

  React.useEffect(() => {
    if (
      !catalogOpenedRef.current &&
      (catalog.status === 'ready' || catalog.status === 'loading-more') &&
      catalog.items.length > 0
    ) {
      catalogOpenedRef.current = true;
      trackEvent('unified_catalog_opened', {
        item_count: catalog.items.length,
      });
    }
  }, [catalog]);

  if (catalog.status === 'loading') {
    return (
      <View style={styles.center} testID="unified-lessons-loading">
        <ActivityIndicator color={theme.colors.primary} />
        <AppText variant="label" color="secondary">
          Loading lessons…
        </AppText>
      </View>
    );
  }

  if (catalog.status === 'error' && catalog.items.length === 0) {
    return (
      <View style={styles.center} testID="unified-lessons-error">
        <AppText variant="h3" style={styles.errorTitle}>
          Could not load lessons.
        </AppText>
        <AppText variant="label" color="secondary">
          {catalog.error.message}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading lessons"
          onPress={catalog.refresh}
          testID="unified-lessons-retry"
        >
          <AppText variant="label">Try again</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="unified-lessons-content">
      <UnifiedLessonCatalogView
        items={catalog.items}
        hasMore={
          catalog.status === 'ready' || catalog.status === 'loading-more'
            ? catalog.hasMore
            : false
        }
        refreshing={catalog.status === 'refreshing'}
        onOpenLesson={onOpenLesson ?? (() => {})}
        onLoadMore={catalog.loadMore}
        onRefresh={catalog.refresh}
      />
    </View>
  );
}

export function UnifiedLessonsRouteScreen(
  props: UnifiedLessonsRouteScreenProps,
) {
  const {navigation} = props;
  return (
    <AppScreen>
      <UnifiedLessonsScreen
        onOpenLesson={lessonId =>
          navigation.navigate('CurriculumLesson', {lessonId})
        }
      />
    </AppScreen>
  );
}
