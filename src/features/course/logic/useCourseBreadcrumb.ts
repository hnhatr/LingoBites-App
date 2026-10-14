import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';

import type {HeaderCrumb} from '@ui/components/ScreenHeader';

import type {CourseFlowParamList} from '../screens/navigationTypes';

type Navigation = NativeStackNavigationProp<CourseFlowParamList>;

/**
 * The header breadcrumb of a curriculum screen: the course, level and unit
 * screens under it in the Courses tab (`Tiếng Anh giao tiếp › A1`). Each
 * crumb pops straight back to its screen instead of one Back per screen.
 */
export function useCourseBreadcrumb(
  navigation: Navigation,
  routeKey: string,
): HeaderCrumb[] {
  const {t} = useTranslation();
  const {routes} = navigation.getState();
  const current = routes.findIndex(route => route.key === routeKey);
  if (current <= 0) return [];

  const crumbs: HeaderCrumb[] = [];
  routes.slice(0, current).forEach((route, index) => {
    const back = () => navigation.pop(current - index);
    switch (route.name) {
      case 'CourseLevels': {
        const params = route.params as CourseFlowParamList['CourseLevels'];
        crumbs.push({
          label: params.title ?? t('course.levels_title'),
          onPress: back,
          testID: 'course-breadcrumb-course',
        });
        if (params.levelCode) {
          crumbs.push({
            label: params.levelCode,
            onPress: back,
            testID: 'course-breadcrumb-level',
          });
        }
        return;
      }
      case 'LevelUnits':
      case 'UnitLessons': {
        const params = route.params as {title?: string};
        crumbs.push({
          label:
            params.title ??
            t(
              route.name === 'LevelUnits'
                ? 'course.units_title'
                : 'course.lessons_title',
            ),
          onPress: back,
          testID: `course-breadcrumb-${route.name}`,
        });
        return;
      }
    }
  });
  return crumbs;
}
