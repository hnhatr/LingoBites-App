import React from 'react';
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
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {useAppNavigation} from '@core/navigation';

import {useMomentLibrary} from '../logic/useMomentLibrary';

/** E5 (S2): the "Khoảnh khắc" list: photo thumbnail, intent, situation, date. */
export function MomentLibraryList({emptyHint}: {emptyHint: string}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const navigation = useAppNavigation();
  const offline = useIsOffline();
  const clearance = useFloatingTabBarClearance();
  const {state, load} = useMomentLibrary();

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
      contentContainerStyle={{
        gap: theme.spacing.md,
        padding: theme.gutter,
        paddingBottom: clearance,
      }}
      data={state.moments}
      keyExtractor={item => item.lessonId}
      renderItem={({item}) => (
        <Pressable
          accessibilityHint={t('moment.library_card_hint')}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => {
            trackEvent('moment_reopened', {intent: item.intent ?? 'unknown'});
            navigation.openLesson(item.lessonId);
          }}
          style={[styles.card, {borderColor: theme.colors.accentSoft}]}
          testID={`moment-card-${item.lessonId}`}
        >
          {item.thumbnailUri ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{uri: item.thumbnailUri}}
              style={styles.thumb}
            />
          ) : (
            <View
              style={[styles.thumb, {backgroundColor: theme.colors.accentSoft}]}
            />
          )}
          <View style={styles.grow}>
            <AppText variant="h3" numberOfLines={2}>
              {item.title}
            </AppText>
            {item.intent ? (
              <AppText color="secondary" variant="caption">
                {t(`moment.intent_${item.intent}`)}
              </AppText>
            ) : null}
            {item.situationTitleVi ? (
              <AppText color="secondary" variant="caption">
                {item.situationTitleVi}
              </AppText>
            ) : null}
            <AppText color="muted" variant="caption">
              {new Date(item.createdAt).toLocaleDateString()}
            </AppText>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  loading: {marginTop: 32},
  notice: {paddingBottom: 4},
  box: {gap: 12, padding: 16},
  card: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  thumb: {borderRadius: 12, height: 72, width: 72},
  grow: {flex: 1, gap: 2},
});
