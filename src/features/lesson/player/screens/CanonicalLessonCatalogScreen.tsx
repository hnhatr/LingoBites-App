import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  LessonCard,
  lessonCardDurationLabel,
  lessonCardKind,
  type LessonCardProgress,
  lessonContextLabel,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import {
  listCompletedLessons,
  listInProgressLessonIds,
} from '@core/sync/lessonProgress';
import {useLessonBookmarks} from '@core/sync/useLessonBookmarks';

import {listLessonDownloads} from '../logic/canonicalDownloadRepository';
import {useCanonicalCatalog} from '../logic/useCanonicalCatalog';
import type {LessonFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LessonFlowParamList, 'CanonicalCatalog'>;

type LocalCardState = {
  downloadedIds: ReadonlySet<string>;
  progress: ReadonlyMap<string, LessonCardProgress>;
};

/** Downloads and progress on this phone; empty if the database is not open. */
function readLocalCardState(): LocalCardState {
  try {
    const progress = new Map<string, LessonCardProgress>();
    for (const lessonId of listInProgressLessonIds()) {
      progress.set(lessonId, {state: 'in_progress'});
    }
    for (const row of listCompletedLessons()) {
      progress.set(row.lessonId, {state: 'completed'});
    }
    return {
      downloadedIds: new Set(listLessonDownloads().map(d => d.lessonId)),
      progress,
    };
  } catch {
    return {downloadedIds: new Set(), progress: new Map()};
  }
}

/**
 * Canonical catalog: every visible lesson (admin and learner sources) in one
 * list; each row opens the same player. Rows are the shared lesson card.
 */
export function CanonicalLessonCatalogScreen({navigation}: Props) {
  const appNavigation = useAppNavigation();
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const floatingClearance = useFloatingTabBarClearance();
  const {state, refresh, loadMore} = useCanonicalCatalog();
  const {isBookmarked, toggleBookmark} = useLessonBookmarks();
  const local = useMemo(
    () =>
      state.status === 'ready'
        ? readLocalCardState()
        : {downloadedIds: new Set<string>(), progress: new Map()},
    [state.status],
  );

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
          renderItem={({item}) => {
            const {title, subtitle} = splitLessonTitle(item.title);
            const contextLabel =
              lessonContextLabel(item.unit) ??
              (item.origin === 'learner' ? t('lessonPlayer.hero_mine') : null);
            return (
              <LessonCard
                accessibilityHint={t('lessonPlayer.catalog_row_hint')}
                bookmarked={isBookmarked(item.id)}
                context={contextLabel}
                downloaded={local.downloadedIds.has(item.id)}
                durationLabel={lessonCardDurationLabel({
                  estimatedMinutes: item.estimated_minutes,
                  youtubeDurationMs: item.youtube_duration_ms,
                  sentenceCount: item.sentence_count,
                })}
                exerciseCount={item.activity_count}
                kind={lessonCardKind(item.source_type)}
                onPress={() => appNavigation.openLesson(item.id)}
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
                progress={local.progress.get(item.id)}
                sentenceCount={item.sentence_count}
                subtitle={subtitle}
                testID={`canonical-catalog-row-${item.id}`}
                title={title}
              />
            );
          }}
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
