import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {CurriculumList} from '../components/CurriculumList';
import {LevelUnitList} from '../components/LevelUnitList';
import {useCourseLevels} from '../logic/useCurriculum';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'CourseLevels'>;

/**
 * One course (F14): its levels as a switcher, then the chosen level's units,
 * so a unit is one tap from the course instead of a separate level screen.
 * The chosen level is kept in the route, so back from a unit keeps it.
 */
export function CourseLevelsScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {courseSlug, title, levelId} = route.params;
  const {state, refresh} = useCourseLevels(courseSlug);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const levels = state.status === 'ready' ? state.data : [];
  const selected =
    levels.find(level => level.id === levelId) ?? levels[0] ?? null;

  // Keep the shown level in the route: deeper screens read its code for
  // their breadcrumb, and it survives going back.
  useEffect(() => {
    if (
      selected &&
      (selected.id !== levelId || selected.code !== route.params.levelCode)
    ) {
      navigation.setParams({levelId: selected.id, levelCode: selected.code});
    }
  }, [navigation, selected, levelId, route.params.levelCode]);

  const header =
    selected && levels.length > 1 ? (
      <View style={themedStyles.levels}>
        <View style={themedStyles.chips} testID="course-levels-switcher">
          {levels.map(level => (
            <Chip
              accessibilityHint={t('course.level_switch_hint')}
              key={level.id}
              label={level.title}
              onPress={() =>
                navigation.setParams({
                  levelId: level.id,
                  levelCode: level.code,
                })
              }
              selected={level.id === selected.id}
              testID={`course-levels-chip-${level.id}`}
            />
          ))}
        </View>
        {selected.description.trim().length > 0 ? (
          <AppText
            color="secondary"
            testID="course-levels-description"
            variant="label"
          >
            {selected.description}
          </AppText>
        ) : null}
      </View>
    ) : undefined;

  return (
    <AppScreen>
      <ScreenHeader
        title={title ?? t('course.levels_title')}
        subtitle={selected && levels.length === 1 ? selected.title : undefined}
        onBack={() => navigation.goBack()}
      />
      {selected ? (
        <LevelUnitList
          // A new level starts from its own loading state, never the old list.
          key={selected.id}
          header={header}
          levelId={selected.id}
          onOpenUnit={unit =>
            navigation.push('UnitLessons', {
              unitId: unit.id,
              title: unit.title,
            })
          }
          testID="course-levels-units"
        />
      ) : (
        <CurriculumList
          emptyMessage={t('course.levels_empty')}
          onRetry={refresh}
          rows={[]}
          status={state.status}
          testID="course-levels"
        />
      )}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    levels: {
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
  });
}
