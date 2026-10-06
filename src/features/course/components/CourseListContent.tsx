import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';

import {useAppNavigation} from '@core/navigation';

import {useCourses} from '../logic/useCurriculum';
import {CurriculumList} from './CurriculumList';

/**
 * Published courses; a row opens the course's levels. Shared by the Library
 * "Khóa học" segment and the course list screen. Without published content
 * it shows the empty state.
 */
export function CourseListContent() {
  const navigation = useAppNavigation();
  const {t} = useTranslation();
  const {state, refresh} = useCourses();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const rows =
    state.status === 'ready'
      ? state.data.map(course => ({
          id: course.id,
          title: course.title,
          description: course.description,
          accessibilityHint: t('course.course_row_hint'),
          onPress: () =>
            navigation.openCourse({
              kind: 'course',
              courseSlug: course.slug,
              title: course.title,
            }),
        }))
      : [];

  return (
    <CurriculumList
      emptyMessage={t('course.courses_empty')}
      onRetry={refresh}
      layout="grid"
      rows={rows}
      status={state.status}
      testID="course-list"
    />
  );
}
