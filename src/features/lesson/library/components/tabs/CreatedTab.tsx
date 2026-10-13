import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {ComposeRequestCards} from '@features/lesson/player';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getHardShadow} from '@ui/theme/hardShadow';

import {useAppNavigation} from '@core/navigation';
import {useFeatureEnabled} from '@core/release';

import {
  getLibrarySection,
  lessonBelongsToSection,
} from '../../logic/librarySections';
import {
  useLibrarySegments,
  useRefreshOnRefocus,
} from '../../logic/useLibrarySegments';
import {LessonsTabContent} from '../LessonsTabContent';

/** The sections whose lessons the learner made themselves. */
const CREATED_SECTIONS = [
  getLibrarySection('mine'),
  getLibrarySection('video'),
];

/**
 * "Bài tôi tạo": start a lesson from text/photo or a YouTube link, then the
 * lessons being made and the ones already on this phone.
 */
export function CreatedTab() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const practiceEnabled = useFeatureEnabled('shortPractice');
  // Read the lessons once the tab has been drawn, so switching to it is
  // not held up by the local read.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);
  const {packagedLessons, refresh} = useLibrarySegments({lessons: ready});

  useRefreshOnRefocus(refresh);

  const lessons = useMemo(
    () =>
      packagedLessons.filter(lesson =>
        CREATED_SECTIONS.some(section =>
          lessonBelongsToSection(section, lesson),
        ),
      ),
    [packagedLessons],
  );

  return (
    <View style={styles.container} testID="library-created-tab">
      <View style={styles.actions}>
        <Pressable
          accessibilityHint="Tạo bài từ văn bản hoặc ảnh"
          accessibilityLabel="Từ văn bản"
          accessibilityRole="button"
          onPress={() => appNavigation.openCreate()}
          style={({pressed}) => [
            styles.action,
            {
              backgroundColor: solidOver(
                theme.colors.accentSoft,
                theme.colors.surface,
              ),
            },
            pressed && styles.pressed,
          ]}
          testID="library-create-text"
        >
          <MaterialIcon color={theme.colors.primary} name="edit" size={22} />
          <AppText style={styles.actionText}>Từ văn bản</AppText>
        </Pressable>
        <Pressable
          accessibilityHint="Tạo bài từ một video YouTube"
          accessibilityLabel="Từ YouTube"
          accessibilityRole="button"
          onPress={() => appNavigation.startCreate({kind: 'youtube'})}
          style={({pressed}) => [
            styles.action,
            {
              backgroundColor: solidOver(
                theme.colors.secondarySoft,
                theme.colors.surface,
              ),
            },
            pressed && styles.pressed,
          ]}
          testID="library-create-youtube"
        >
          <MaterialIcon
            color={theme.colors.secondary}
            name="play_circle"
            size={22}
          />
          <AppText style={styles.actionText}>Từ YouTube</AppText>
        </Pressable>
      </View>
      {/* S4.3: six-step lessons still being made. */}
      <View style={styles.requests}>
        <ComposeRequestCards />
      </View>
      {ready ? (
        <LessonsTabContent
          packagedLessons={lessons}
          packagedTitle={null}
          onPracticeLesson={
            practiceEnabled ? appNavigation.openPractice : undefined
          }
        />
      ) : (
        <ActivityIndicator
          color={theme.colors.primary}
          style={styles.loading}
        />
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    action: {
      alignItems: 'center',
      borderColor: theme.colors.ink,
      borderRadius: 16,
      borderWidth: 2,
      flex: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      ...getHardShadow(3, theme.colors.ink),
    },
    pressed: {
      transform: [{translateY: 2}],
      ...getHardShadow(1, theme.colors.ink),
    },
    actionText: {
      fontSize: 14,
      fontWeight: '700',
    },
    requests: {
      paddingHorizontal: theme.gutter,
    },
    loading: {
      marginTop: theme.spacing.xl,
    },
  });
}
