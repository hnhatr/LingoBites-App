import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {AppScreen} from '@ui/components/AppScreen';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {LevelUnitList} from '../components/LevelUnitList';
import {useCourseBreadcrumb} from '../logic/useCourseBreadcrumb';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'LevelUnits'>;

/**
 * Units of one level (F14), opened straight from a level (the learning path
 * on Home); the course screen shows the same list under its level switcher.
 */
export function LevelUnitsScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const {levelId, title} = route.params;
  const breadcrumb = useCourseBreadcrumb(navigation, route.key);

  return (
    <AppScreen>
      <ScreenHeader
        breadcrumb={breadcrumb}
        title={title ?? t('course.units_title')}
        onBack={() => navigation.goBack()}
      />
      <LevelUnitList
        levelId={levelId}
        onOpenUnit={unit =>
          navigation.push('UnitLessons', {unitId: unit.id, title: unit.title})
        }
        testID="level-units"
      />
    </AppScreen>
  );
}
