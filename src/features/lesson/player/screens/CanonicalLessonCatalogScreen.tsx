import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type {LessonsStackParamList} from '@features/lesson/library';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {openLesson} from '../logic/lessonNavigation';
import {useCanonicalCatalog} from '../logic/useCanonicalCatalog';

type Props = NativeStackScreenProps<LessonsStackParamList, 'CanonicalCatalog'>;

/**
 * Canonical catalog: every visible lesson (admin and learner sources) in one
 * list; each row opens the same player. Rows use the Library lesson card
 * layout (title, summary, small chips) instead of contract field names.
 */
export function CanonicalLessonCatalogScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const floatingClearance = useFloatingTabBarClearance();
  const {state, refresh, loadMore} = useCanonicalCatalog();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <AppScreen>
      <ScreenHeader
        title={t('lessonPlayer.catalog_title')}
        onBack={() => navigation.goBack()}
      />
      {state.status === 'loading' || state.status === 'idle' ? (
        <ActivityIndicator
          color={theme.colors.primary}
          style={themedStyles.loading}
          testID="canonical-catalog-loading"
        />
      ) : state.status === 'error' ? (
        <View style={themedStyles.errorBox}>
          <AppText color="danger" testID="canonical-catalog-error">
            {state.error.message || t('lessonPlayer.catalog_load_failed')}
          </AppText>
          <AppButton
            accessibilityHint={t('lessonPlayer.retry_load_hint')}
            onPress={refresh}
            testID="canonical-catalog-retry"
            title={t('common.retry')}
            variant="secondary"
          />
        </View>
      ) : (
        <FlatList
          testID="canonical-catalog-list"
          data={state.lessons}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityHint={t('lessonPlayer.catalog_row_hint')}
              testID={`canonical-catalog-row-${item.id}`}
              onPress={() => openLesson(navigation, item.id)}
            >
              <AppCard>
                <View style={styles.cardContent}>
                  <AppText
                    testID={`canonical-catalog-title-${item.id}`}
                    variant="h3"
                  >
                    {item.title}
                  </AppText>
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
                  <View style={styles.chipRow}>
                    {item.unit ? (
                      <Chip label={item.unit.level_title} tone="gold" />
                    ) : null}
                    <Chip
                      label={t('lessonPlayer.catalog_sentences', {
                        count: item.sentence_count,
                      })}
                      tone="neutral"
                    />
                    {item.origin === 'learner' ? (
                      <Chip
                        label={t('lessonPlayer.hero_mine')}
                        tone="accentSoft"
                      />
                    ) : null}
                  </View>
                </View>
              </AppCard>
            </Pressable>
          )}
          onEndReached={state.nextCursor ? loadMore : undefined}
          contentContainerStyle={[
            themedStyles.list,
            {paddingBottom: floatingClearance},
          ]}
        />
      )}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
