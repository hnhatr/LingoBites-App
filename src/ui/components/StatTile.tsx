import React from 'react';
import {StyleSheet, View} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {useAppTheme} from '../theme';
import {solidOver} from '../theme/colorUtils';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

type StatTone = 'teal' | 'coral' | 'gold';

type Props = {
  icon: HandoffIconName;
  label: string;
  value: string | number;
  tone?: StatTone;
};

/** Compact icon + value + label tile used in progress summaries. */
export function StatTile({icon, label, value, tone = 'teal'}: Props) {
  const {theme} = useAppTheme();
  const {colors} = theme;
  const palette =
    tone === 'coral'
      ? {bg: colors.secondarySoft, fg: colors.secondary}
      : tone === 'gold'
      ? {bg: colors.tertiarySoft, fg: colors.tertiary}
      : {bg: colors.accentSoft, fg: colors.primary};

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[
        styles.tile,
        {
          backgroundColor: solidOver(palette.bg, colors.surface),
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <MaterialIcon color={palette.fg} name={icon} size={22} />
      <View style={styles.copy}>
        <AppText
          numberOfLines={1}
          style={[styles.value, {color: palette.fg}]}
          variant="h3"
        >
          {value}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    minWidth: 0,
  },
  tile: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  value: {
    fontWeight: '700',
  },
});
