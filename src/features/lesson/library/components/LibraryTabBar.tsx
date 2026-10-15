import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {LibraryTab, LibraryTabConfig} from '../logic/librarySections';
import {libraryTone} from './libraryTones';

export interface LibraryTabBarProps {
  tabs: readonly LibraryTabConfig[];
  selected: LibraryTab;
  onSelect: (tab: LibraryTab) => void;
}

/**
 * The Library tabs, at the top of the screen: a small pastel bubble per tab
 * with its name underneath. Every bubble sits on a shelf of its own colour;
 * the open tab fills with its colour on a darker shelf, and a short bar
 * marks it under the name.
 */
export function LibraryTabBar({tabs, selected, onSelect}: LibraryTabBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View accessibilityRole="tablist" style={styles.bar} testID="library-tabs">
      {tabs.map(tab => {
        const isSelected = tab.id === selected;
        const tone = libraryTone(theme, tab.tone);
        const shelfColor = isSelected
          ? solidOver(withAlpha('#000000', 0.3), tone.strong)
          : solidOver(withAlpha(tone.strong, 0.38), tone.soft);
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
            {({pressed}) => (
              <>
                <View
                  style={[
                    styles.bubble,
                    {backgroundColor: isSelected ? tone.strong : tone.soft},
                    getStickerEdge(pressed ? 1 : 3, shelfColor),
                    pressed && styles.bubblePressed,
                  ]}
                >
                  <MaterialIcon
                    color={isSelected ? tone.onStrong : tone.ink}
                    name={tab.icon}
                    size={20}
                  />
                </View>
                <AppText
                  numberOfLines={1}
                  style={[styles.label, isSelected && styles.labelOn]}
                >
                  {tab.title}
                </AppText>
                <View
                  style={[
                    styles.indicator,
                    {backgroundColor: tone.strong},
                    !isSelected && styles.indicatorOff,
                  ]}
                />
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    tab: {
      alignItems: 'center',
      flex: 1,
      gap: 6,
    },
    bubble: {
      alignItems: 'center',
      borderRadius: 14,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    bubblePressed: {
      transform: [{translateY: 2}],
    },
    label: {
      color: theme.colors.text.muted,
      fontSize: 11.5,
      fontWeight: '800',
    },
    labelOn: {
      color: theme.colors.text.primary,
    },
    // Keeps its height on every tab so the names stay on one line.
    indicator: {
      borderRadius: theme.radius.pill,
      height: 4,
      width: 22,
    },
    indicatorOff: {
      opacity: 0,
    },
  });
}
