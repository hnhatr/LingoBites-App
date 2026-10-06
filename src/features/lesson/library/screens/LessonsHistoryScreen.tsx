import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useState} from 'react';
import {InteractionManager, ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {
  GRID_TILE_GAP,
  GridTile,
  gridTileToneAt,
  useGridTileWidth,
} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {CreateLessonHeaderButton} from '../components/CreateLessonHeaderButton';
import {LibraryLoadingNotice} from '../components/LibraryLoadingNotice';
import {
  isOwnLessonSection,
  lessonBelongsToSection,
  LIBRARY_SECTIONS,
  type LibraryGroup,
  type LibrarySectionConfig,
  type LibrarySectionId,
} from '../logic/librarySections';
import {
  useLibrarySegments,
  useRefreshOnRefocus,
} from '../logic/useLibrarySegments';
import type {LessonsStackParamList} from './navigationTypes';

const GROUPS: {id: LibraryGroup; title: string}[] = [
  {id: 'mine', title: 'Của tôi'},
  {id: 'explore', title: 'Khám phá'},
];

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

export type LessonsHistoryScreenProps = Props;

/** The Library hub: one card per section, each opening its own list. */
export function LessonsHistoryScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const appNavigation = useAppNavigation();
  const tileWidth = useGridTileWidth();
  // Counts come from reading every download; load them after the tab has
  // painted so the first open shows the tiles right away.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);
  const {packagedLessons, vocabulary, grammar, refresh} = useLibrarySegments({
    lessons: ready,
    vocabulary: ready,
    grammar: ready,
  });

  useRefreshOnRefocus(refresh);

  const counts = useMemo(() => {
    const result = {} as Record<LibrarySectionId, number>;
    LIBRARY_SECTIONS.forEach(section => {
      if (isOwnLessonSection(section)) {
        result[section.id] = packagedLessons.filter(lesson =>
          lessonBelongsToSection(section, lesson),
        ).length;
      } else if (section.id === 'vocabulary') {
        result[section.id] = vocabulary.length;
      } else if (section.id === 'grammar') {
        result[section.id] = grammar.length;
      } else {
        // Public sections live on the server: no local count.
        result[section.id] = 0;
      }
    });
    return result;
  }, [packagedLessons, vocabulary, grammar]);

  const countLabel = (section: LibrarySectionConfig) =>
    section.catalog
      ? 'Cần kết nối mạng'
      : !ready
      ? 'Đang tải…'
      : counts[section.id] > 0
      ? `${counts[section.id]} ${section.unit}`
      : section.emptyHint;

  return (
    <AppScreen>
      <ScreenHeader
        title="Thư viện"
        rightAction={
          <CreateLessonHeaderButton
            onPress={() => appNavigation.openCreate()}
          />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
        testID="library-hub"
      >
        <AppText variant="label" color="secondary" style={styles.subtitle}>
          Bài đã tải về học được cả khi không có mạng.
        </AppText>
        {ready ? null : (
          <LibraryLoadingNotice message="Đang tải dữ liệu thư viện, vui lòng đợi…" />
        )}
        {GROUPS.map(group => (
          <View
            key={group.id}
            style={styles.group}
            testID={`library-group-${group.id}`}
          >
            <AppText variant="h3" style={styles.groupTitle}>
              {group.title}
            </AppText>
            <View style={styles.cards}>
              {LIBRARY_SECTIONS.filter(
                section => section.group === group.id,
              ).map((section, index) => (
                <GridTile
                  key={section.id}
                  icon={section.icon}
                  title={section.title}
                  subtitle={section.description}
                  meta={countLabel(section)}
                  tone={gridTileToneAt(
                    index + (group.id === 'explore' ? 1 : 0),
                  )}
                  width={tileWidth}
                  accessibilityLabel={`${section.title}. ${countLabel(
                    section,
                  )}`}
                  accessibilityHint={section.description}
                  onPress={() =>
                    navigation.navigate('LibraryList', {section: section.id})
                  }
                  testID={`library-card-${section.id}`}
                  metaTestID={`library-card-${section.id}-count`}
                />
              ))}
            </View>
          </View>
        ))}
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
    subtitle: {
      marginBottom: theme.spacing.sm,
    },
    group: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    groupTitle: {
      color: theme.colors.text.primary,
    },
    cards: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_TILE_GAP,
    },
  });
}
