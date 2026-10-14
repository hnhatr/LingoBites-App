import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';

import {trackEvent} from '@features/analytics';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {GRID_TILE_GAP, useGridTileWidth} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {useAppNavigation} from '@core/navigation';

import {getLibrarySection} from '../../logic/librarySections';
import type {MomentLibraryItem} from '../../logic/momentLibrary';
import {useMomentLibrary} from '../../logic/useMomentLibrary';
import {ToneCard} from '../ExploreCards';
import {LibraryShelf} from '../LibraryShelf';
import {cardToneAt} from '../libraryTones';
import {PhotoCard} from '../ToneTiles';

/**
 * "Khoảnh khắc": a card to start a new moment, then a two-column grid of
 * the lessons made from situations and photos.
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

  return (
    <FlatList
      ListHeaderComponent={
        <View style={styles.header}>
          <LibraryShelf
            label="khoảnh khắc"
            subtitle="Bài học từ ảnh và tình huống của bạn"
            title="Khoảnh khắc"
            tone="violet"
          >
            <ToneCard
              accessibilityHint="Chụp ảnh hoặc kể một tình huống để tạo bài"
              action={{label: 'Tạo bài', glyph: 'add', solid: true}}
              cover={{imageUrl: null, glyph: 'chat'}}
              description="Chụp ảnh hoặc kể một tình huống"
              gutter={theme.gutter}
              onPress={() => navigation.startCreate({kind: 'situation'})}
              testID="library-moments-new"
              title="Khoảnh khắc mới"
              tone="accent"
            />
          </LibraryShelf>
          {state.fromCache ? (
            <AppText color="secondary" variant="caption">
              {t('moment.library_offline')}
            </AppText>
          ) : null}
        </View>
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
      data={state.moments}
      keyExtractor={item => item.lessonId}
      numColumns={2}
      renderItem={({item, index}) => (
        <MomentCell index={index} item={item} width={cellWidth} />
      )}
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
  const navigation = useAppNavigation();

  return (
    <PhotoCard
      accessibilityHint={t('moment.library_card_hint')}
      imageUri={item.thumbnailUri ?? null}
      onPress={() => {
        trackEvent('moment_reopened', {intent: item.intent ?? 'unknown'});
        navigation.openLesson(item.lessonId);
      }}
      testID={`moment-card-${item.lessonId}`}
      title={item.title}
      tone={cardToneAt(index + 1)}
      width={width}
    />
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
    header: {
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    notice: {
      paddingBottom: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    grid: {
      gap: GRID_TILE_GAP + 4,
      padding: theme.gutter,
    },
    row: {
      gap: GRID_TILE_GAP,
    },
  });
}
