/**
 * HomeCoursesRail — "Khóa học của bạn": the published courses as short
 * coloured cards in a horizontal rail, the same cards as the Courses tab.
 * Hidden while loading, on error, or when there is no course, so Home never
 * shows an empty box for it.
 */
import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {
  CourseCard,
  courseCardToneAt,
  type CourseWithAccess,
  curriculumGlyph,
  useCourses,
} from '@features/course';

import {AppText} from '@ui/components/AppText';
import {showToast} from '@ui/components/toast';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {LINK_HIT_SLOP} from '../logic/homeScreenModel';
import {HomeIcon} from './HomeSvgIcons';

const CARD_WIDTH = 284;

export function HomeCoursesRail() {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useAppNavigation();
  const {state, refresh} = useCourses();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const openCourse = useCallback(
    (course: CourseWithAccess) => {
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
    [navigation, t],
  );

  if (state.status !== 'ready' || state.data.length === 0) return null;
  // Courses the learner can open come first.
  const courses = [...state.data].sort(
    (a, b) => Number(b.unlocked) - Number(a.unlocked),
  );

  return (
    <View style={styles.section} testID="home-courses-section">
      <View style={styles.header}>
        <AppText style={styles.title} variant="title">
          {t('home.courses_title')}
        </AppText>
        <Pressable
          accessibilityLabel={t('home.courses_view_all_a11y')}
          accessibilityRole="button"
          hitSlop={LINK_HIT_SLOP}
          onPress={() => navigation.openCourse()}
          style={styles.viewAll}
          testID="home-courses-view-all"
        >
          <AppText style={styles.viewAllText}>
            {t('home.saved_rail_view_all')}
          </AppText>
          <HomeIcon
            color={theme.colors.primary}
            name="chevron_right"
            size={18}
          />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.rail}
        decelerationRate="fast"
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        style={styles.scroller}
      >
        {courses.map((course, index) => (
          <CourseCard
            key={course.id}
            accessibilityHint={
              course.unlocked
                ? t('course.course_row_hint')
                : t('course.course_locked_hint')
            }
            actionLabel={
              course.unlocked
                ? t('course.course_start')
                : t('course.course_locked_action')
            }
            compact
            coverTestID={`home-course-cover-${course.id}`}
            description={course.description}
            glyph={curriculumGlyph(course.title, course.description)}
            gutter={theme.gutter}
            imageUrl={course.coverUrl}
            locked={!course.unlocked}
            onPress={() => openCourse(course)}
            testID={`home-course-${course.id}`}
            title={course.title}
            tone={courseCardToneAt(index)}
            width={CARD_WIDTH}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: 8,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: 17,
      fontWeight: '700',
    },
    viewAll: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      minHeight: 40,
      paddingLeft: 8,
    },
    viewAllText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    // Bleeds to the right edge so the next card peeks in.
    scroller: {
      marginRight: -16,
    },
    rail: {
      gap: 12,
      paddingBottom: 6,
      paddingRight: 16,
    },
  });
}
