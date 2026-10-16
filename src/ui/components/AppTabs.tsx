import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {AppText} from './AppText';
import {withAlpha} from './layout';
import {MaterialIcon} from './MaterialIcon';

export type AppTab<T extends string> = {
  id: T;
  label: string;
  icon?: HandoffIconName;
  /** A small count after the label, e.g. how many words the tab holds. */
  count?: number;
};

export type AppTabsProps<T extends string> = {
  tabs: readonly AppTab<T>[];
  value: T;
  onChange: (id: T) => void;
  /** `sm` for a tight spot. */
  size?: 'md' | 'sm';
  accessibilityHint?: string;
  /** Each tab gets `${testID}-${id}`. */
  testID: string;
};

/**
 * The app's one row of tabs: a white pill on a soft cream edge, the open tab
 * on a light mint fill. Used wherever a screen switches between a few views
 * of the same content (Tất cả / Chưa học / Đã nhớ, Từ vựng / Câu…).
 */
export function AppTabs<T extends string>({
  tabs,
  value,
  onChange,
  size = 'md',
  accessibilityHint,
  testID,
}: AppTabsProps<T>) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const small = size === 'sm';
  return (
    <View accessibilityRole="tablist" style={styles.bar} testID={testID}>
      {tabs.map(tab => {
        const on = tab.id === value;
        const ink = on ? theme.colors.primary : theme.colors.text.muted;
        return (
          <Pressable
            accessibilityHint={accessibilityHint}
            accessibilityLabel={
              tab.count !== undefined ? `${tab.label}, ${tab.count}` : tab.label
            }
            accessibilityRole="tab"
            accessibilityState={{selected: on}}
            hitSlop={small ? 6 : 4}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({pressed}) => [
              styles.tab,
              small ? styles.tabSmall : null,
              on ? styles.tabOn : null,
              pressed && !on ? styles.pressed : null,
            ]}
            testID={`${testID}-${tab.id}`}
          >
            {tab.icon ? (
              <MaterialIcon
                color={ink}
                name={tab.icon}
                size={small ? 14 : 16}
              />
            ) : null}
            <AppText
              numberOfLines={1}
              style={[
                styles.label,
                small ? styles.labelSmall : null,
                on ? styles.labelOn : null,
                {color: ink},
              ]}
            >
              {tab.label}
            </AppText>
            {tab.count !== undefined ? (
              <View style={[styles.count, on ? styles.countOn : null]}>
                <AppText style={[styles.countText, {color: ink}]}>
                  {tab.count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 2,
      padding: 3,
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    tab: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
      minHeight: 32,
      paddingHorizontal: 6,
    },
    tabSmall: {
      minHeight: 28,
    },
    tabOn: {
      backgroundColor: theme.colors.accentSoft,
    },
    pressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    label: {
      flexShrink: 1,
      fontSize: 12.5,
      fontWeight: '700',
    },
    labelSmall: {
      fontSize: 11.5,
    },
    labelOn: {
      fontWeight: '800',
    },
    count: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 5,
    },
    countOn: {
      backgroundColor: withAlpha(theme.colors.surface, 0.7),
    },
    countText: {
      fontSize: 10,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
  });
}
