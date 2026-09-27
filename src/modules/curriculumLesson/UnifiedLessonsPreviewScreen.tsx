/**
 * Manual verification entry point for the unified Lesson flow.
 *
 * Added per reporter request (LING-21): opens the TASK-007 unified
 * catalog directly so the flow can be exercised on a real device
 * without enabling the `unifiedLesson` rollout flag for all users.
 * NOT part of the default unified rollout — the route and its Profile
 * menu entry are `__DEV__`-gated like the other developer screens.
 * Opening any item navigates cross-stack to the canonical
 * `CurriculumLesson({lessonId})` route in the Lessons tab.
 */
import React, {useCallback, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {AppScreen} from '@components/AppScreen';
import {ScreenHeader} from '@components/ScreenHeader';
import {useAppTheme, type AppTheme} from '@theme';
import {UnifiedLessonsScreen} from './UnifiedLessonsScreen';

export interface UnifiedLessonsPreviewScreenProps {
  navigation: {
    goBack: () => void;
    getParent: <
      T = {navigate: (screen: string, params?: unknown) => void},
    >() => T | undefined;
  };
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.sm,
    },
  });
}

export function UnifiedLessonsPreviewScreen({
  navigation,
}: UnifiedLessonsPreviewScreenProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleOpenLesson = useCallback(
    (lessonId: string) => {
      navigation
        .getParent<{
          navigate: (
            tab: string,
            params: {screen: string; params: {lessonId: string}},
          ) => void;
        }>()
        ?.navigate('Lessons', {
          screen: 'CurriculumLesson',
          params: {lessonId},
        });
    },
    [navigation],
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <AppScreen>
      <View style={styles.header}>
        <ScreenHeader title="Unified Lessons (Preview)" onBack={handleBack} />
      </View>
      <View style={styles.container} testID="unified-preview-content">
        <UnifiedLessonsScreen onOpenLesson={handleOpenLesson} />
      </View>
    </AppScreen>
  );
}
