import React, {useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {Pressable, StyleSheet, View} from 'react-native';
import type {CurriculumLessonRouteParams} from './navigationTypes';
import {AppCard} from '@components/AppCard';
import {AppText} from '@components/AppText';
import {SectionHeader} from '@components/SectionHeader';
import {useAppTheme, type AppTheme} from '@theme';
import {
  fetchPublishedCurriculumLessons,
  type CurriculumLessonSelectionItem,
} from './curriculumLessonSelection';

/** Runs an async side effect without returning its promise to the caller. */
function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.md,
    },
    pressable: {
      flex: 1,
    },
    cardContent: {
      gap: theme.spacing.xs,
    },
    meta: {
      marginTop: theme.spacing.xs,
    },
  });
}

/**
 * Minimal distinct curriculum entry for the shared Lessons shell
 * (TASK-008). Self-loads the real published catalog through the existing
 * public hierarchy metadata chain and surfaces one section whose items
 * navigate to the namespaced `CurriculumLesson({lessonId})` route.
 * Renders nothing while loading, when the catalog is empty, or when the
 * metadata is unreachable — existing personal/packaged sections are never
 * disturbed and no Lesson V2 behavior changes.
 */
export function CurriculumLessonsEntry() {
  const {theme} = useAppTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation<{
    navigate: (
      screen: 'CurriculumLesson',
      params: CurriculumLessonRouteParams,
    ) => void;
  }>();
  const [lessons, setLessons] = useState<
    CurriculumLessonSelectionItem[] | null
  >(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    fireAndForget(
      fetchPublishedCurriculumLessons({signal: controller.signal}).then(
        result => {
          if (!mountedRef.current || controller.signal.aborted) {
            return;
          }
          if (result.ok) {
            setLessons(result.lessons);
          }
        },
      ),
    );
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  if (!lessons || lessons.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="curriculum-entry-section">
      <SectionHeader title="Curriculum" />
      {lessons.map(item => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          accessibilityHint="Curriculum lesson. Opens the guided lesson."
          onPress={() =>
            navigation.navigate('CurriculumLesson', {lessonId: item.id})
          }
          testID={`curriculum-entry-item-${item.id}`}
          style={styles.pressable}
        >
          <AppCard>
            <View style={styles.cardContent}>
              <AppText
                variant="h3"
                testID={`curriculum-entry-title-${item.id}`}
              >
                {item.title}
              </AppText>
              {item.description ? (
                <AppText
                  variant="label"
                  color="secondary"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  testID={`curriculum-entry-summary-${item.id}`}
                >
                  {item.description}
                </AppText>
              ) : null}
              <AppText
                variant="caption"
                color="secondary"
                style={styles.meta}
                testID={`curriculum-entry-meta-${item.id}`}
              >
                {`${item.courseTitle} · ${item.levelTitle} · ${item.unitTitle}`}
                {item.estimatedMinutes != null
                  ? ` · ${item.estimatedMinutes} min`
                  : ''}
              </AppText>
            </View>
          </AppCard>
        </Pressable>
      ))}
    </View>
  );
}
