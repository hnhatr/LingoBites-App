import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {TextField} from '@ui/components/TextField';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import {
  LIBRARY_SOURCE_FILTER_OPTIONS,
  type LibrarySourceFilter,
} from '../logic/lesson';

export interface SearchAndFilterBarProps {
  searchQuery: string;
  sourceFilter: LibrarySourceFilter;
  onSearchChange: (query: string) => void;
  onFilterChange: (filter: LibrarySourceFilter) => void;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    searchContainer: {
      position: 'relative',
      justifyContent: 'center',
    },
    searchIcon: {
      position: 'absolute',
      left: theme.spacing.md,
      // Vertically centered over the 48pt-min-height input; the 24pt glyph
      // is pulled up by half its height so it stays centered.
      top: '50%',
      marginTop: -12,
      zIndex: 1,
    },
    searchInput: {
      paddingLeft: theme.spacing.xl + theme.spacing.lg,
    },
    toggleRow: {
      alignItems: 'flex-start',
    },
    filterRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingRight: theme.spacing.xl,
    },
  });
}

export function SearchAndFilterBar({
  searchQuery,
  sourceFilter,
  onSearchChange,
  onFilterChange,
}: SearchAndFilterBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Source chips stay folded behind one toggle so the list gets the space.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeLabel =
    LIBRARY_SOURCE_FILTER_OPTIONS.find(option => option.key === sourceFilter)
      ?.label ?? '';

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View pointerEvents="none" style={styles.searchIcon}>
          <MaterialIcon
            name="search"
            size={24}
            color={theme.colors.text.secondary}
          />
        </View>
        <TextField
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Tìm kiếm..."
          accessibilityLabel="Tìm kiếm trong Thư viện"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.toggleRow}>
        <Chip
          label={`Nguồn: ${activeLabel} ${filtersOpen ? '▴' : '▾'}`}
          selected={sourceFilter !== 'all'}
          onPress={() => setFiltersOpen(open => !open)}
          accessibilityHint="Mở hoặc đóng bộ lọc theo nguồn bài học"
          testID="filter-toggle"
        />
      </View>

      {filtersOpen ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {LIBRARY_SOURCE_FILTER_OPTIONS.map(filter => (
            <Chip
              key={filter.key}
              label={filter.label}
              selected={sourceFilter === filter.key}
              onPress={() => onFilterChange(filter.key)}
              testID={`filter-chip-${filter.key}`}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
