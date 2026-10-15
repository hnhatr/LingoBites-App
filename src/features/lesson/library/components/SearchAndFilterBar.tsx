import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';

import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import type {AppTheme} from '@ui/theme/types';

import {
  LIBRARY_SOURCE_FILTER_OPTIONS,
  type LibrarySourceFilter,
} from '../logic/lesson';

export interface SearchAndFilterBarProps {
  searchQuery: string;
  /** Omit (with `onFilterChange`) to show the search field alone. */
  sourceFilter?: LibrarySourceFilter;
  onSearchChange: (query: string) => void;
  onFilterChange?: (filter: LibrarySourceFilter) => void;
  /** What the field searches, e.g. "Tìm theo từ…". */
  placeholder?: string;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    searchField: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 14,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    searchInput: {
      color: theme.colors.text.primary,
      flex: 1,
      fontSize: 15,
      paddingVertical: 10,
    },
    clear: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 9,
      height: 26,
      justifyContent: 'center',
      width: 26,
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
  sourceFilter = 'all',
  onSearchChange,
  onFilterChange,
  placeholder = 'Tìm kiếm...',
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
      <View style={styles.searchField}>
        <MaterialIcon
          name="search"
          size={22}
          color={theme.colors.text.secondary}
        />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.muted}
          accessibilityLabel="Tìm kiếm trong Thư viện"
          returnKeyType="search"
          style={styles.searchInput}
          testID="library-search-input"
        />
        {searchQuery ? (
          <Pressable
            accessibilityHint="Xóa nội dung tìm kiếm"
            accessibilityLabel="Xóa tìm kiếm"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onSearchChange('')}
            style={styles.clear}
            testID="library-search-clear"
          >
            <MaterialIcon
              name="close"
              size={15}
              color={theme.colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>

      {onFilterChange ? (
        <View style={styles.toggleRow}>
          <Chip
            label={`Nguồn: ${activeLabel} ${filtersOpen ? '▴' : '▾'}`}
            selected={sourceFilter !== 'all'}
            onPress={() => setFiltersOpen(open => !open)}
            accessibilityHint="Mở hoặc đóng bộ lọc theo nguồn bài học"
            testID="filter-toggle"
          />
        </View>
      ) : null}

      {onFilterChange && filtersOpen ? (
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
