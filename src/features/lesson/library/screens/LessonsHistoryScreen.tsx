import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {LibraryHubCard} from '../components/LibraryHubCard';
import {
  isLessonSection,
  lessonBelongsToSection,
  LIBRARY_SECTIONS,
  type LibrarySectionConfig,
  type LibrarySectionId,
} from '../logic/librarySections';
import {useLibrarySegments} from '../logic/useLibrarySegments';
import type {LessonsStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

export type LessonsHistoryScreenProps = Props;

/** The Library hub: one card per section, each opening its own list. */
export function LessonsHistoryScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const {packagedLessons, vocabulary, grammar, refresh} = useLibrarySegments();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const counts = useMemo(() => {
    const result = {} as Record<LibrarySectionId, number>;
    LIBRARY_SECTIONS.forEach(section => {
      if (isLessonSection(section)) {
        result[section.id] = packagedLessons.filter(lesson =>
          lessonBelongsToSection(section, lesson.sourceType),
        ).length;
      } else {
        result[section.id] =
          section.id === 'vocabulary' ? vocabulary.length : grammar.length;
      }
    });
    return result;
  }, [packagedLessons, vocabulary, grammar]);

  const countLabel = (section: LibrarySectionConfig) =>
    counts[section.id] > 0
      ? `${counts[section.id]} ${section.unit}`
      : section.emptyHint;

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
        testID="library-hub"
      >
        <AppText variant="h2" style={styles.title}>
          Thư viện
        </AppText>
        <AppText variant="label" color="secondary" style={styles.subtitle}>
          Bài học đã tải về học được cả khi không có mạng.
        </AppText>
        <View style={styles.cards}>
          {LIBRARY_SECTIONS.map(section => (
            <LibraryHubCard
              key={section.id}
              icon={section.icon}
              title={section.title}
              description={section.description}
              countLabel={countLabel(section)}
              hasItems={counts[section.id] > 0}
              onPress={() =>
                navigation.navigate('LibraryList', {section: section.id})
              }
              testID={`library-card-${section.id}`}
            />
          ))}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.sm,
      padding: theme.gutter,
    },
    title: {
      color: theme.colors.text.primary,
    },
    subtitle: {
      marginBottom: theme.spacing.sm,
    },
    cards: {
      gap: theme.spacing.md,
    },
  });
}
