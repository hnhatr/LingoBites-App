import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';

import {AppScreen} from '@ui/components/AppScreen';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {useAppNavigation} from '@core/navigation';

import {CurriculumList} from '../components/CurriculumList';
import {useCourseLevels} from '../logic/useCurriculum';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'CourseLevels'>;

/** Levels of one course, in course order (F14). */
export function CourseLevelsScreen({navigation, route}: Props) {
  const appNavigation = useAppNavigation();
  const {t} = useTranslation();
  const {courseSlug, title} = route.params;
  const {state, refresh} = useCourseLevels(courseSlug);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const rows =
    state.status === 'ready'
      ? state.data.map(level => ({
          id: level.id,
          eyebrow: level.code,
          title: level.title,
          description: level.description,
          accessibilityHint: t('course.level_row_hint'),
          onPress: () =>
            appNavigation.openCourse({
              kind: 'level',
              levelId: level.id,
              title: level.title,
            }),
        }))
      : [];

  return (
    <AppScreen>
      <ScreenHeader
        title={title ?? t('course.levels_title')}
        onBack={() => navigation.goBack()}
      />
      <CurriculumList
        emptyMessage={t('course.levels_empty')}
        onRetry={refresh}
        rows={rows}
        status={state.status}
        testID="course-levels"
      />
    </AppScreen>
  );
}
