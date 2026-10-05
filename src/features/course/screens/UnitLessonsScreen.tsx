import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {Chip} from '@ui/components/Chip';
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

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const ready = state.status === 'ready' ? state.data : null;
  const rows = ready
    ? ready.lessons.map((lesson, index) => {
        const completed = ready.completedIds.has(lesson.id);
        return {
          id: lesson.id,
          eyebrow: t('course.lesson_number', {number: index + 1}),
          title: lesson.title,
          description: lesson.description,
          footer:
            completed || lesson.estimatedMinutes !== null ? (
              <View style={styles.chipRow}>
                {completed ? (
                  <Chip
                    label={t('course.lesson_completed')}
                    testID={`unit-lesson-completed-${lesson.id}`}
                    tone="accentSoft"
                  />
                ) : null}
                {lesson.estimatedMinutes !== null ? (
                  <Chip
                    label={t('course.lesson_minutes', {
                      count: lesson.estimatedMinutes,
                    })}
                    tone="neutral"
                  />
                ) : null}
              </View>
            ) : null,
          accessibilityHint: t('course.lesson_row_hint'),
          onPress: () => appNavigation.openLesson(lesson.id),
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

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
