import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';

import {AppScreen} from '@ui/components/AppScreen';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {useAppNavigation} from '@core/navigation';

import {CurriculumList} from '../components/CurriculumList';
import {UnitProgressBar} from '../components/UnitProgressBar';
import {useLevelUnits} from '../logic/useCurriculum';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'LevelUnits'>;

/**
 * Units of one level, each with a progress bar of its completed lessons
 * (F14). Re-counted on focus, so finishing a lesson updates the bar on back.
 */
export function LevelUnitsScreen({navigation, route}: Props) {
  const appNavigation = useAppNavigation();
  const {t} = useTranslation();
  const {levelId, title} = route.params;
  const {state, refresh} = useLevelUnits(levelId);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const rows =
    state.status === 'ready'
      ? state.data.map(({unit, progress}, index) => ({
          id: unit.id,
          eyebrow: t('course.unit_number', {number: index + 1}),
          title: unit.title,
          // The unit's first can-do says what it is for; else its blurb.
          description: unit.canDo[0]
            ? t('course.unit_can_do', {text: unit.canDo[0]})
            : unit.description,
          footer: progress ? (
            <UnitProgressBar
              progress={progress}
              testID={`unit-progress-${unit.id}`}
            />
          ) : null,
          accessibilityHint: t('course.unit_row_hint'),
          onPress: () =>
            appNavigation.openCourse({
              kind: 'unit',
              unitId: unit.id,
              title: unit.title,
            }),
        }))
      : [];

  return (
    <AppScreen>
      <ScreenHeader
        title={title ?? t('course.units_title')}
        onBack={() => navigation.goBack()}
      />
      <CurriculumList
        emptyMessage={t('course.units_empty')}
        onRetry={refresh}
        rows={rows}
        status={state.status}
        testID="level-units"
      />
    </AppScreen>
  );
}
