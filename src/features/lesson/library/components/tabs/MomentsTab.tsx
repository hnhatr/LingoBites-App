import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {trackEvent} from '@features/analytics';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {
  GRID_TILE_GAP,
  gridTileToneAt,
  useGridTileWidth,
} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {useAppNavigation} from '@core/navigation';

import {getLibrarySection} from '../../logic/librarySections';
import type {MomentLibraryItem} from '../../logic/momentLibrary';
import {useMomentLibrary} from '../../logic/useMomentLibrary';
import {shelfTone} from '../LibraryShelf';

/** The grid's first cell: start a new moment. */
const NEW_MOMENT = 'new' as const;

type Cell = typeof NEW_MOMENT | MomentLibraryItem;

/**
 * "Khoảnh khắc": a two-column grid of the lessons made from situations and
 * photos, opening with a cell to start a new one.
 */
export function MomentsTab() {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useAppNavigation();
  const offline = useIsOffline();
  const clearance = useFloatingTabBarClearance();
  const cellWidth = useGridTileWidth();
  const {state, load} = useMomentLibrary();

  if (state.status === 'loading') {
    return (
      <ActivityIndicator color={theme.colors.primary} style={styles.loading} />
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.box}>
        <AppText color="danger" testID="library-moments-error">
          {offline ? t('moment.library_offline') : state.message}
        </AppText>
        <AppButton
          accessibilityHint={t('moment.library_retry_hint')}
          onPress={() => {
            load();
          }}
          testID="library-moments-retry"
          title={t('common.retry')}
          variant="secondary"
        />
      </View>
    );
  }

  const cells: Cell[] = [NEW_MOMENT, ...state.moments];

  return (
    <FlatList
      ListHeaderComponent={
        state.fromCache ? (
          <AppText color="secondary" style={styles.notice} variant="caption">
            {t('moment.library_offline')}
          </AppText>
        ) : null
      }
      ListFooterComponent={
        state.moments.length === 0 ? (
          <AppText
            color="secondary"
            style={styles.notice}
            testID="library-moments-empty"
          >
            {getLibrarySection('moments').emptyHint}
          </AppText>
        ) : null
      }
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.grid, {paddingBottom: clearance}]}
      data={cells}
      keyExtractor={cell => (cell === NEW_MOMENT ? cell : cell.lessonId)}
      numColumns={2}
      renderItem={({item, index}) =>
        item === NEW_MOMENT ? (
          <Pressable
            accessibilityHint="Chụp ảnh hoặc kể một tình huống để tạo bài"
            accessibilityLabel="Khoảnh khắc mới"
            accessibilityRole="button"
            onPress={() => navigation.startCreate({kind: 'situation'})}
            style={({pressed}) => [
              styles.cell,
              styles.newCell,
              {width: cellWidth},
              pressed && styles.pressed,
            ]}
            testID="library-moments-new"
          >
            <MaterialIcon
              color={theme.colors.text.muted}
              name="add_photo_alternate"
              size={30}
            />
            <AppText color="muted" style={styles.newText}>
              Khoảnh khắc mới
            </AppText>
          </Pressable>
        ) : (
          <MomentCell index={index} item={item} width={cellWidth} />
        )
      }
      testID="library-moments-tab"
    />
  );
}

function MomentCell({
  item,
  index,
  width,
}: {
  item: MomentLibraryItem;
  index: number;
  width: number;
}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useAppNavigation();
  const {face, ink} = shelfTone(theme, gridTileToneAt(index));

  return (
    <Pressable
      accessibilityHint={t('moment.library_card_hint')}
      accessibilityLabel={item.title}
      accessibilityRole="button"
      onPress={() => {
        trackEvent('moment_reopened', {intent: item.intent ?? 'unknown'});
        navigation.openLesson(item.lessonId);
      }}
      style={({pressed}) => [
        styles.cell,
        styles.card,
        {width},
        pressed && styles.pressed,
      ]}
      testID={`moment-card-${item.lessonId}`}
    >
      {item.thumbnailUri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{uri: item.thumbnailUri}}
          style={styles.photo}
        />
      ) : (
        <View style={[styles.photo, styles.cover, {backgroundColor: face}]}>
          <MaterialIcon color={ink} name="auto_awesome" size={32} />
        </View>
      )}
      <AppText numberOfLines={2} style={styles.title}>
        {item.title}
      </AppText>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    loading: {
      marginTop: theme.spacing.xl,
    },
    box: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
    notice: {
      paddingBottom: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    grid: {
      gap: GRID_TILE_GAP,
      padding: theme.gutter,
    },
    row: {
      gap: GRID_TILE_GAP,
    },
    cell: {
      borderRadius: 18,
      borderWidth: 2,
      overflow: 'hidden',
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    newCell: {
      alignItems: 'center',
      borderColor: theme.colors.outline,
      borderStyle: 'dashed',
      gap: theme.spacing.xs,
      justifyContent: 'center',
      minHeight: 150,
    },
    newText: {
      fontSize: 13,
      fontWeight: '700',
    },
    card: {
      backgroundColor: theme.colors.surface,
    },
    photo: {
      height: 96,
      width: '100%',
    },
    cover: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md - 2,
      paddingTop: theme.spacing.sm,
    },
  });
}
