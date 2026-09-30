import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {TextField} from '@ui/components/TextField';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

export interface SearchAndFilterBarProps {
  searchQuery: string;
  sourceFilter: 'all' | 'offline' | 'image_ocr' | 'paste';
  onSearchChange: (query: string) => void;
  onFilterChange: (filter: 'all' | 'offline' | 'image_ocr' | 'paste') => void;
}

const FILTER_OPTIONS = [
  {key: 'all' as const, label: 'Tất cả'},
  {key: 'offline' as const, label: 'Offline'},
  {key: 'image_ocr' as const, label: 'Ảnh / OCR'},
  {key: 'paste' as const, label: 'Dán văn bản'},
] as const;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
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
    filterRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map(filter => (
          <Chip
            key={filter.key}
            label={filter.label}
            selected={sourceFilter === filter.key}
            onPress={() => onFilterChange(filter.key)}
            testID={`filter-chip-${filter.key}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}
