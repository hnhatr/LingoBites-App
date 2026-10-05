import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useFeatureFlags} from '@core/release';

import {useAppTheme} from '../theme';
import {
  productionThemeOptions,
  SYSTEM_THEME_ID,
  SYSTEM_THEME_LABEL,
  type ThemePreference,
  themeReleaseFlag,
  themes,
} from '../theme/themeRegistry';

type PickerOption = {id: ThemePreference; label: string};

/**
 * Fixed preview-control geometry (SETE-269 P1). These chips must keep a
 * stable layout while they are being used, so radius, padding, and type
 * are constants — not inherited from the theme being selected (which
 * previously moved targets under the user's finger when switching).
 * Colors still follow the active theme for selected-state feedback.
 */
const PICKER_CHIP_RADIUS = 999;
const PICKER_CHIP_PADDING_HORIZONTAL = 16;
const PICKER_CHIP_PADDING_VERTICAL = 10;
const PICKER_CHIP_FONT_SIZE = 14;

export function ThemePicker() {
  const {theme, themeId, setThemeId} = useAppTheme();
  const {isFeatureEnabled} = useFeatureFlags();

  if (!isFeatureEnabled('themeSwitcher')) {
    return null;
  }

  // Settings offers only Sáng / Tối / Sticker / Theo hệ thống in every
  // build. The other themes (pastel-kids, core, neo, comic, cartoon) stay
  // registered in themeRegistry but are hidden from the picker.
  const options: PickerOption[] = productionThemeOptions
    .filter(id => {
      if (id === SYSTEM_THEME_ID) {
        return true;
      }
      const flag = themeReleaseFlag[id];
      return flag === undefined || isFeatureEnabled(flag);
    })
    .map(id => ({
      id,
      label: id === SYSTEM_THEME_ID ? SYSTEM_THEME_LABEL : themes[id].name,
    }));

  return (
    <View style={styles.row}>
      {options.map(({id, label}) => {
        const selected = id === themeId;
        return (
          <Pressable
            key={id}
            testID={`theme-option-${id}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{selected}}
            onPress={() => setThemeId(id)}
            style={[
              styles.chip,
              {
                borderColor: theme.colors.border,
                borderRadius: PICKER_CHIP_RADIUS,
                minHeight: 44,
                paddingHorizontal: PICKER_CHIP_PADDING_HORIZONTAL,
                paddingVertical: PICKER_CHIP_PADDING_VERTICAL,
              },
              selected && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <Text
              style={{
                color: selected
                  ? theme.colors.text.inverse
                  : theme.colors.text.secondary,
                fontSize: PICKER_CHIP_FONT_SIZE,
                fontWeight: '600',
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
  },
});
