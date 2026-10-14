import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {LibraryTab, LibraryTabConfig} from '../logic/librarySections';
import {libraryTone} from './libraryTones';

export interface LibraryTabBarProps {
  tabs: readonly LibraryTabConfig[];
  selected: LibraryTab;
  onSelect: (tab: LibraryTab) => void;
}

/**
 * The Library tabs: a pastel bubble per tab with its name underneath. The
 * open tab fills with its colour, tilts and lifts, with a dot below it.
 */
export function LibraryTabBar({tabs, selected, onSelect}: LibraryTabBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View accessibilityRole="tablist" style={styles.bar} testID="library-tabs">
      {tabs.map(tab => {
        const isSelected = tab.id === selected;
        const tone = libraryTone(theme, tab.tone);
        return (
          <Pressable
            accessibilityHint={`Mở tab ${tab.title}`}
            accessibilityLabel={tab.title}
            accessibilityRole="tab"
            accessibilityState={{selected: isSelected}}
            hitSlop={4}
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={({pressed}) => [styles.tab, pressed && styles.pressed]}
            testID={`library-tab-${tab.id}`}
          >
            <View
              style={[
                styles.bubble,
                {backgroundColor: isSelected ? tone.strong : tone.soft},
                isSelected && styles.bubbleOn,
              ]}
            >
              <MaterialIcon
                color={isSelected ? tone.onStrong : tone.ink}
                name={tab.icon}
                size={26}
              />
            </View>
            <AppText
              numberOfLines={1}
              style={[styles.label, isSelected && styles.labelOn]}
            >
              {tab.title}
            </AppText>
            <View
              style={[styles.pip, isSelected && {backgroundColor: tone.strong}]}
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
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    tab: {
      alignItems: 'center',
      flex: 1,
      gap: 6,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    bubble: {
      alignItems: 'center',
      borderRadius: 20,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    bubbleOn: {
      transform: [{translateY: -3}, {rotate: '-6deg'}],
      ...(getStickerFace(theme, 3) ?? {
        borderColor: theme.colors.outlineVariant,
        borderWidth: 1,
      }),
    },
    label: {
      color: theme.colors.text.muted,
      fontSize: 12.5,
      fontWeight: '800',
    },
    labelOn: {
      color: theme.colors.text.primary,
    },
    pip: {
      borderRadius: 3,
      height: 6,
      marginTop: -2,
      width: 6,
    },
  });
}
