import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {
  GRID_TILE_GAP,
  GridTile,
  gridTileToneAt,
  useGridTileWidth,
} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {Medallion} from '@ui/components/Medallion';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type CurriculumRow = {
  id: string;
  title: string;
  description?: string;
  /** Small label above the title (level code, lesson number). */
  eyebrow?: string;
  /** Extra content under the description (progress bar, completed mark). */
  footer?: React.ReactNode;
  /** Locked (paid) content the user has not unlocked. */
  locked?: boolean;
  accessibilityHint: string;
  onPress: () => void;
  /** Replaces the default list card (e.g. a `LessonCard` for lessons). */
  card?: React.ReactElement;
};

type Props = {
  status: 'loading' | 'error' | 'ready';
  rows: CurriculumRow[];
  emptyMessage: string;
  onRetry: () => void;
  /** Prefix for list/row test ids, e.g. `course-list`. */
  testID: string;
  header?: React.ReactElement;
  /** `grid`: two-column tiles (course list); `list`: one card per row. */
  layout?: 'list' | 'grid';
};

/**
 * One list layout for every curriculum level (courses, levels, units,
 * lessons): loading spinner, retryable error, empty state, then cards.
 */
export function CurriculumList({
  status,
  rows,
  emptyMessage,
  onRetry,
  testID,
  header,
  layout = 'list',
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const floatingClearance = useFloatingTabBarClearance();
  const tileWidth = useGridTileWidth();
  const isGrid = layout === 'grid';

  if (status === 'loading') {
    return (
      <ActivityIndicator
        color={theme.colors.primary}
        style={themedStyles.loading}
        testID={`${testID}-loading`}
      />
    );
  }

  if (status === 'error') {
    return (
      <View style={themedStyles.errorBox}>
        <AppText color="danger" testID={`${testID}-error`}>
          {t('course.load_failed')}
        </AppText>
        <AppButton
          accessibilityHint={t('course.retry_hint')}
          onPress={onRetry}
          testID={`${testID}-retry`}
          title={t('common.retry')}
          variant="secondary"
        />
      </View>
    );
  }

  return (
    <FlatList
      testID={testID}
      data={rows}
      keyExtractor={item => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={themedStyles.empty}>
          <Medallion label="🎓" />
          <AppText
            color="secondary"
            style={styles.centered}
            testID={`${testID}-empty`}
          >
            {emptyMessage}
          </AppText>
        </View>
      }
      numColumns={isGrid ? 2 : 1}
      columnWrapperStyle={isGrid ? {gap: GRID_TILE_GAP} : undefined}
      renderItem={({item, index}) =>
        item.card && !isGrid ? (
          item.card
        ) : isGrid ? (
          <GridTile
            icon="menu_book"
            title={item.title}
            subtitle={item.description?.trim() || undefined}
            meta={item.eyebrow}
            locked={item.locked}
            tone={gridTileToneAt(index)}
            width={tileWidth}
            accessibilityHint={item.accessibilityHint}
            onPress={item.onPress}
            testID={`${testID}-row-${item.id}`}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={item.accessibilityHint}
            testID={`${testID}-row-${item.id}`}
            onPress={item.onPress}
          >
            <AppCard>
              <View style={styles.cardContent}>
                {item.eyebrow ? (
                  <AppText color="secondary" variant="caption">
                    {item.eyebrow}
                  </AppText>
                ) : null}
                <View style={styles.titleRow}>
                  <AppText style={styles.titleText} variant="h3">
                    {item.title}
                  </AppText>
                  {item.locked ? (
                    <MaterialIcon
                      color={theme.colors.text.secondary}
                      name="lock"
                      size={18}
                    />
                  ) : null}
                </View>
                {item.description && item.description.trim().length > 0 ? (
                  <AppText
                    color="secondary"
                    ellipsizeMode="tail"
                    numberOfLines={2}
                    variant="label"
                  >
                    {item.description}
                  </AppText>
                ) : null}
                {item.footer}
              </View>
            </AppCard>
          </Pressable>
        )
      }
      contentContainerStyle={[
        themedStyles.list,
        {paddingBottom: floatingClearance},
      ]}
    />
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    empty: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
    },
    errorBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      margin: theme.gutter,
      padding: theme.spacing.lg,
    },
    list: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    loading: {
      marginTop: theme.spacing.xl,
    },
  });
}

const styles = StyleSheet.create({
  cardContent: {
    gap: 6,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  titleText: {
    flexShrink: 1,
  },
  centered: {
    textAlign: 'center',
  },
});
