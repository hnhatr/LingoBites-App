import React, {useMemo} from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {solidOver} from '../theme/colorUtils';
import {getHardShadow} from '../theme/hardShadow';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

export type GridTileTone = 'accent' | 'tertiary' | 'secondary' | 'neutral';

/** Gap between tiles and the screen gutter the grid sits in (see tileWidth). */
export const GRID_TILE_GAP = 12;

/** Width of one tile in a two-column grid inside the screen gutter. */
export function useGridTileWidth(columns = 2): number {
  const {width} = useWindowDimensions();
  const {theme} = useAppTheme();
  return Math.floor(
    (width - theme.gutter * 2 - GRID_TILE_GAP * (columns - 1)) / columns,
  );
}

const TONES: GridTileTone[] = ['accent', 'tertiary', 'secondary', 'neutral'];

/** Cycles tones so neighbouring tiles differ (index-based). */
export function gridTileToneAt(index: number): GridTileTone {
  return TONES[index % TONES.length];
}

type Props = {
  icon: HandoffIconName;
  title: string;
  /** What the tile holds, one or two lines. */
  subtitle?: string;
  /** Short strong line at the bottom, e.g. "3 bài". */
  meta?: string;
  tone?: GridTileTone;
  /** Shows a lock badge (paid content not yet unlocked). */
  locked?: boolean;
  width: number;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  metaTestID?: string;
};

/**
 * Sticker tile for two-column grids (Library hub, course list): tinted face,
 * ink outline and hard shadow, like Home's shortcut tiles.
 */
export function GridTile({
  icon,
  title,
  subtitle,
  meta,
  tone = 'neutral',
  locked = false,
  width,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  metaTestID,
}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {face, ink} = resolveTone(theme, tone);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({pressed}) => [
        styles.tile,
        {backgroundColor: face, width},
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={styles.iconRow}>
        <View style={styles.iconBox}>
          <MaterialIcon color={ink} name={icon} size={24} />
        </View>
        {locked ? <MaterialIcon color={ink} name="lock" size={20} /> : null}
      </View>
      <AppText style={[styles.title, {color: ink}]} numberOfLines={2}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText style={[styles.subtitle, {color: ink}]} numberOfLines={2}>
          {subtitle}
        </AppText>
      ) : null}
      {meta ? (
        <AppText
          style={[styles.meta, {color: ink}]}
          numberOfLines={2}
          testID={metaTestID}
        >
          {meta}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function resolveTone(theme: AppTheme, tone: GridTileTone) {
  const {colors} = theme;
  switch (tone) {
    case 'accent':
      return {
        face: solidOver(colors.accentSoft, colors.surface),
        ink: colors.primary,
      };
    case 'tertiary':
      return {
        face: solidOver(colors.tertiarySoft, colors.surface),
        ink: colors.onTertiaryContainer,
      };
    case 'secondary':
      return {
        face: solidOver(colors.secondarySoft, colors.surface),
        ink: colors.secondary,
      };
    default:
      return {
        face: solidOver(colors.surfaceContainer, colors.surface),
        ink: colors.text.primary,
      };
  }
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    tile: {
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      gap: 6,
      minHeight: 150,
      padding: 14,
      ...getHardShadow(4, theme.colors.ink),
    },
    pressed: {
      transform: [{translateY: 3}],
      ...getHardShadow(1, theme.colors.ink),
    },
    iconRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    iconBox: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.ink,
      borderRadius: 14,
      borderWidth: 2,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '600',
      opacity: 0.85,
    },
    meta: {
      fontSize: 12,
      fontWeight: '800',
      marginTop: 'auto',
    },
  });
}
