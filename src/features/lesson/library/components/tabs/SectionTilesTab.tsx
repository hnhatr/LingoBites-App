import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {
  GRID_TILE_GAP,
  GridTile,
  gridTileToneAt,
  useGridTileWidth,
} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
  LIBRARY_SECTIONS,
  type LibrarySectionConfig,
  type LibraryTab,
} from '../../logic/librarySections';
import {useLibraryCounts} from '../../logic/useLibraryCounts';
import {useRefreshOnRefocus} from '../../logic/useLibrarySegments';

/** One tile per section of a tab, each opening that section's list. */
export function SectionTilesTab({tab}: {tab: LibraryTab}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const appNavigation = useAppNavigation();
  const tileWidth = useGridTileWidth();
  const {counts, refresh} = useLibraryCounts();

  useRefreshOnRefocus(refresh);

  const countLabel = (section: LibrarySectionConfig) =>
    section.catalog
      ? 'Cần kết nối mạng'
      : `${counts[section.id]} ${section.unit}`;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
    >
      <View style={styles.cards}>
        {LIBRARY_SECTIONS.filter(section => section.tab === tab).map(
          (section, index) => (
            <GridTile
              key={section.id}
              icon={section.icon}
              title={section.title}
              meta={countLabel(section)}
              tone={gridTileToneAt(index)}
              width={tileWidth}
              accessibilityLabel={`${section.title}. ${countLabel(section)}`}
              accessibilityHint={section.description}
              onPress={() => appNavigation.openLibrarySection(section.id)}
              testID={`library-card-${section.id}`}
            />
          ),
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      padding: theme.gutter,
    },
    cards: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_TILE_GAP,
    },
  });
}
