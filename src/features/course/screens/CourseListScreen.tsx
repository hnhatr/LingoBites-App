import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';

import {CourseListContent} from '../components/CourseListContent';

/**
 * Published courses (F14); the Courses tab's root, so it has no header bar
 * or back button, only a large title that scrolls with the courses.
 */
export function CourseListScreen() {
  const {t} = useTranslation();
  return (
    <AppScreen>
      <CourseListContent
        header={
          <View style={styles.title}>
            <AppText testID="course-list-title" variant="display">
              {t('course.courses_title')}
            </AppText>
            <AppText color="secondary" variant="label">
              {t('course.courses_subtitle')}
            </AppText>
          </View>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    gap: 2,
    paddingBottom: 4,
    paddingTop: 12,
  },
});
