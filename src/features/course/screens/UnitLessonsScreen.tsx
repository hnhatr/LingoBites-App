import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {
  readLessonCardLocalState,
  useLessonBookmarks,
} from '@features/lesson/library';

import {AppScreen} from '@ui/components/AppScreen';
import {
  LessonCard,
  lessonCardDurationLabel,
  lessonCardKind,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {CurriculumList} from '../components/CurriculumList';
import {UnitProgressBar} from '../components/UnitProgressBar';
import {useUnitLessons} from '../logic/useCurriculum';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'UnitLessons'>;

/**
 * Lessons of one unit in order (F14). A curriculum lesson id is the id the
 * regular player loads, so a row opens the same lesson player.
 */
export function UnitLessonsScreen({navigation, route}: Props) {
  const appNavigation = useAppNavigation();
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {unitId, title} = route.params;
  const {state, refresh} = useUnitLessons(unitId);
  const {isBookmarked, toggleBookmark} = useLessonBookmarks();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const ready = state.status === 'ready' ? state.data : null;
  // Re-read on every load: a lesson may have been downloaded or started.
  const localState = useMemo(
    () => (ready ? readLessonCardLocalState() : null),
    [ready],
  );
  const rows = ready
    ? ready.lessons.map((lesson, index) => {
        const completed = ready.completedIds.has(lesson.id);
        const download = localState?.downloads.get(lesson.id);
        const sourceType = download?.sourceType ?? 'admin_text';
        const sentenceCount = download?.sentenceCount ?? null;
        const lessonNumber = t('course.lesson_number', {number: index + 1});
        const split = splitLessonTitle(lesson.title);
        const onPress = () => appNavigation.openLesson(lesson.id);
        return {
          id: lesson.id,
          title: lesson.title,
          accessibilityHint: t('course.lesson_row_hint'),
          onPress,
          card: (
            <LessonCard
              accessibilityHint={t('course.lesson_row_hint')}
              bookmarked={isBookmarked(lesson.id)}
              contextLead={lessonNumber}
              downloaded={localState?.downloadedIds.has(lesson.id)}
              durationLabel={lessonCardDurationLabel({
                estimatedMinutes: lesson.estimatedMinutes,
                sentenceCount,
              })}
              exerciseCount={localState?.activityCounts.get(lesson.id)}
              kind={lessonCardKind(sourceType)}
              onPress={onPress}
              onToggleBookmark={() =>
                toggleBookmark({
                  lessonId: lesson.id,
                  title: lesson.title,
                  sourceType,
                  sentenceCount: sentenceCount ?? 0,
                  estimatedMinutes: lesson.estimatedMinutes,
                  contextLabel: title ?? null,
                })
              }
              progress={
                completed
                  ? {state: 'completed'}
                  : localState?.progress.get(lesson.id)
              }
              sentenceCount={sentenceCount}
              subtitle={split.subtitle}
              testID={`unit-lessons-row-${lesson.id}`}
              title={split.title}
            />
          ),
        };
      })
    : [];

  return (
    <AppScreen>
      <ScreenHeader
        title={title ?? t('course.lessons_title')}
        onBack={() => navigation.goBack()}
      />
      <CurriculumList
        emptyMessage={t('course.lessons_empty')}
        header={
          ready && ready.lessons.length > 0 ? (
            <View style={themedStyles.progress}>
              <UnitProgressBar
                progress={ready.progress}
                testID="unit-lessons-progress"
              />
            </View>
          ) : undefined
        }
        onRetry={refresh}
        rows={rows}
        status={state.status}
        testID="unit-lessons"
      />
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    progress: {
      paddingBottom: theme.spacing.sm,
    },
  });
}
