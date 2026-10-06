import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {AppScreen} from '@ui/components/AppScreen';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {CourseListContent} from '../components/CourseListContent';
import type {CoursesStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CoursesStackParamList, 'CourseList'>;

/** Published courses (F14); the Courses tab's hub, so it has no back button. */
export function CourseListScreen({navigation}: Props) {
  const {t} = useTranslation();
  return (
    <AppScreen>
      <ScreenHeader
        title={t('course.courses_title')}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <CourseListContent />
    </AppScreen>
  );
}
