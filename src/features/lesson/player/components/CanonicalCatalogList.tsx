import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {CanonicalCatalogState} from '../logic/useCanonicalCatalog';

function catalogStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    list: {gap: theme.spacing.sm, padding: theme.spacing.lg},
  });
}

export type CanonicalCatalogListProps = {
  state: CanonicalCatalogState;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenLesson: (lessonId: string) => void;
  contentPaddingBottom?: number;
};

/**
 * Canonical catalog list body (loading / error / paginated rows), shared by
 * `CanonicalLessonCatalogScreen` and the Library "Tất cả bài" segment.
 */
export function CanonicalCatalogList({
  state,
  onRefresh,
  onLoadMore,
  onOpenLesson,
  contentPaddingBottom,
}: CanonicalCatalogListProps) {
  const {theme} = useAppTheme();
  const styles = catalogStyles(theme);

  if (state.status === 'loading' || state.status === 'idle') {
    return <ActivityIndicator testID="canonical-catalog-loading" />;
  }
  if (state.status === 'error') {
    return (
      <View>
        <AppText testID="canonical-catalog-error">
          {state.error.message}
        </AppText>
        <Pressable
          accessibilityRole="button"
          testID="canonical-catalog-retry"
          onPress={onRefresh}
        >
          <AppText>Retry</AppText>
        </Pressable>
      </View>
    );
  }
  return (
    <FlatList
      testID="canonical-catalog-list"
      data={state.lessons}
      keyExtractor={item => item.id}
      renderItem={({item}) => (
        <Pressable
          accessibilityRole="button"
          testID={`canonical-catalog-row-${item.id}`}
          onPress={() => onOpenLesson(item.id)}
        >
          <View style={styles.row}>
            <AppText testID={`canonical-catalog-title-${item.id}`}>
              {item.title}
            </AppText>
            <AppText>
              {`${item.origin} · ${item.source_type} · ${item.sentence_count} sentences`}
            </AppText>
          </View>
        </Pressable>
      )}
      onEndReached={state.nextCursor ? onLoadMore : undefined}
      contentContainerStyle={[
        styles.list,
        {paddingBottom: contentPaddingBottom},
      ]}
    />
  );
}
