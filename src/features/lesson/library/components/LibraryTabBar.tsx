import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LibraryTab, LibraryTabConfig} from '../logic/librarySections';

export interface LibraryTabBarProps {
  tabs: readonly LibraryTabConfig[];
  selected: LibraryTab;
  onSelect: (tab: LibraryTab) => void;
}

/**
 * Icon-only tabs under the Library title; the selected tab is tinted and
 * underlined. Each icon carries its tab name for screen readers.
 */
export function LibraryTabBar({tabs, selected, onSelect}: LibraryTabBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View accessibilityRole="tablist" style={styles.bar} testID="library-tabs">
      {tabs.map(tab => {
        const isSelected = tab.id === selected;
        return (
          <Pressable
            accessibilityHint={`Mở tab ${tab.title}`}
            accessibilityLabel={tab.title}
            accessibilityRole="tab"
            accessibilityState={{selected: isSelected}}
            hitSlop={4}
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={styles.tab}
            testID={`library-tab-${tab.id}`}
          >
            <MaterialIcon
              color={
                isSelected ? theme.colors.primary : theme.colors.text.muted
              }
              name={tab.icon}
              size={26}
            />
            <View
              style={[styles.underline, isSelected && styles.underlineOn]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
    },
    tab: {
      alignItems: 'center',
      flex: 1,
      paddingTop: theme.spacing.sm,
    },
    underline: {
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      height: 3,
      marginTop: theme.spacing.sm,
      width: '64%',
    },
    underlineOn: {
      backgroundColor: theme.colors.primary,
    },
  });
}
