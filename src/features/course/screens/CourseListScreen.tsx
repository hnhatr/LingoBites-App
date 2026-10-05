import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {AppScreen} from '@ui/components/AppScreen';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {CourseListContent} from '../components/CourseListContent';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'CourseList'>;

/** Published courses (F14). */
export function CourseListScreen({navigation}: Props) {
  const {t} = useTranslation();
  return (
    <AppScreen>
      <ScreenHeader
        title={t('course.courses_title')}
        onBack={() => navigation.goBack()}
      />
      <CourseListContent />
    </AppScreen>
  );
}
