import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

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
import {
  LIBRARY_SECTIONS,
  type LibraryGroup,
  type LibrarySectionConfig,
} from '../logic/librarySections';
import {useLibraryCounts} from '../logic/useLibraryCounts';
import {useRefreshOnRefocus} from '../logic/useLibrarySegments';
import type {LessonsStackParamList} from './navigationTypes';

const GROUPS: {id: LibraryGroup; title: string}[] = [
  {id: 'mine', title: 'Của tôi'},
  {id: 'explore', title: 'Khám phá'},
];

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

export type LessonsHistoryScreenProps = Props;

/** The Library hub: one card per section, each opening its own list. */
export function LessonsHistoryScreen(_props: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const appNavigation = useAppNavigation();
  const tileWidth = useGridTileWidth();
  // Only counts are read here; each section loads its items when opened.
  const {counts, refresh} = useLibraryCounts();

  useRefreshOnRefocus(refresh);

  const countLabel = (section: LibrarySectionConfig) =>
    section.catalog
      ? 'Cần kết nối mạng'
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
                  onPress={() => appNavigation.openLibrarySection(section.id)}
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
