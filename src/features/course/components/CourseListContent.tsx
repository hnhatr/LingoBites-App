import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';

import {LibraryCover} from '@ui/components/LibraryCover';
import {showToast} from '@ui/components/toast';

import {useAppNavigation} from '@core/navigation';

import {curriculumGlyph} from '../logic/curriculumCover';
import {useCourses} from '../logic/useCurriculum';
import {CurriculumList} from './CurriculumList';

/**
 * Published courses, each a compact row beside its cover (the admin's picture, else a
 * default cover with a topic icon); a row opens the course's levels. Shared by the Library
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
          locked: !course.unlocked,
          thumbnail: (
            <LibraryCover
              glyph={curriculumGlyph(course.title, course.description)}
              imageUrl={course.coverUrl}
              shape="pack"
              testID={`course-cover-${course.id}`}
            />
          ),
          accessibilityHint: course.unlocked
            ? t('course.course_row_hint')
            : t('course.course_locked_hint'),
          onPress: () => {
            if (!course.unlocked) {
              showToast(t('course.course_locked_message'));
              return;
            }
            navigation.openCourse({
              kind: 'course',
              courseSlug: course.slug,
              title: course.title,
              coverUrl: course.coverUrl,
            });
          },
        }))
      : [];

  return (
    <CurriculumList
      emptyMessage={t('course.courses_empty')}
      onRetry={refresh}
      rows={rows}
      status={state.status}
      testID="course-list"
    />
  );
}
