import React from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';

import {trackEvent} from '@features/analytics';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {GRID_TILE_GAP, useGridTileWidth} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {cardToneAt} from '@ui/components/ToneCard';
import {useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {useAppNavigation} from '@core/navigation';

import {useMomentLibrary} from '../logic/useMomentLibrary';
import {PhotoCard} from './ToneTiles';

/**
 * E5 (S2): the full "Khoảnh khắc" list, the same two-column photo cards as
 * the Library's Moments tab.
 */
export function MomentLibraryList({emptyHint}: {emptyHint: string}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const navigation = useAppNavigation();
  const offline = useIsOffline();
  const clearance = useFloatingTabBarClearance();
  const {state, load} = useMomentLibrary();
  const cellWidth = useGridTileWidth();

  if (state.status === 'loading') {
    return (
      <ActivityIndicator color={theme.colors.primary} style={styles.loading} />
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.box}>
        <AppText color="danger">
          {offline ? t('moment.library_offline') : state.message}
        </AppText>
        <AppButton
          accessibilityHint={t('moment.library_retry_hint')}
          onPress={() => {
            load();
          }}
          title={t('common.retry')}
          variant="secondary"
        />
      </View>
    );
  }

  if (state.moments.length === 0) {
    return (
      <View style={styles.box}>
        <AppText color="secondary">{emptyHint}</AppText>
      </View>
    );
  }

  return (
    <FlatList
      ListHeaderComponent={
        state.fromCache ? (
          <AppText color="secondary" style={styles.notice} variant="caption">
            {t('moment.library_offline')}
          </AppText>
        ) : null
      }
      columnWrapperStyle={styles.row}
      contentContainerStyle={{
        gap: GRID_TILE_GAP + 4,
        padding: theme.gutter,
        paddingBottom: clearance,
      }}
      data={state.moments}
      keyExtractor={item => item.lessonId}
      numColumns={2}
      renderItem={({item, index}) => (
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
          width={cellWidth}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  loading: {marginTop: 32},
  notice: {paddingBottom: 4},
  box: {gap: 12, padding: 16},
  row: {gap: GRID_TILE_GAP},
});
