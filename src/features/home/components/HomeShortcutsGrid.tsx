/**
 * HomeShortcutsGrid — "Luyện thêm" section title + one row of 4 sticker icons
 * (LING-256, LING-267, §VS-4).
 *
 * Each cell is a tinted icon tile with a short title under it. A shortcut
 * with something waiting (due review cards) carries a count badge and a
 * status line; the full sub-line stays in the accessibility label.
 *
 * Color mapping matches mockup v4 (§VS-4):
 *   1. video    -> accentSoft / primary
 *   2. review   -> tertiarySoft / onTertiaryContainer
 *   3. speaking -> secondarySoft / secondary
 *   4. create   -> surfaceContainer / text.primary
 *
 * Motion (§VS-7):
 *   - I6 (press wiggle +/-10° over 500ms): off under RM
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';

import type {ShortcutItem, ShortcutKey} from '../logic/homeScreenModel';
import {getHardShadow} from './HomeDecorations';
import {HomeIcon} from './HomeSvgIcons';

const GRID_PALETTE = {
  badgeText: '#ffffff',
};

type Props = {
  shortcuts: ShortcutItem[];
  onPress: (key: ShortcutKey) => void;
};

// Static tilt: -6° on tiles 1 & 3, +5° on tiles 2 & 4 (§VS-4)
const STATIC_TILT: Record<ShortcutKey, number> = {
  video: -6,
  review: 5,
  speaking: -6,
  create: 5,
};

const BG_MAP: Record<
  ShortcutKey,
  'accentSoft' | 'tertiarySoft' | 'secondarySoft' | 'surfaceContainer'
> = {
  video: 'accentSoft',
  review: 'tertiarySoft',
  speaking: 'secondarySoft',
  create: 'surfaceContainer',
};

const INK_MAP: Record<
  ShortcutKey,
  'primary' | 'onTertiaryContainer' | 'secondary' | 'text.primary'
> = {
  video: 'primary',
  review: 'onTertiaryContainer',
  speaking: 'secondary',
  create: 'text.primary',
};

function ShortcutCell({
  item,
  onPress,
}: {
  item: ShortcutItem;
  onPress: () => void;
}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // I6: Press wiggle +/-10° over 500ms (§VS-7)
  const baseTilt = reducedMotion ? 0 : STATIC_TILT[item.key];
  const wiggle = useSharedValue(0);

  const handlePressIn = () => {
    if (!reducedMotion && !item.disabled) {
      wiggle.value = withSequence(
        withTiming(10, {duration: 125}),
        withTiming(-10, {duration: 125}),
        withTiming(5, {duration: 125}),
        withTiming(0, {duration: 125}),
      );
    }
  };

  const iconTileAnimStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${baseTilt + wiggle.value}deg`}],
  }));

  // Opaque: the hard shadow would otherwise bleed through the tint.
  const backgroundColor = solidOver(
    theme.colors[BG_MAP[item.key]],
    theme.colors.surface,
  );
  const inkKey = INK_MAP[item.key];
  const ink =
    inkKey === 'text.primary'
      ? theme.colors.text.primary
      : theme.colors[inkKey];

  const titleText = t(item.titleKey);
  const subText = item.subKey ? t(item.subKey, item.metaParams) : '';

  const isDisabled = item.disabled;
  const a11yLabel = subText ? `${titleText}. ${subText}` : titleText;

  return (
    <View style={styles.cellWrapper}>
      <Pressable
        accessibilityLabel={a11yLabel}
        accessibilityRole="button"
        accessibilityState={isDisabled ? {disabled: true} : undefined}
        disabled={isDisabled}
        hitSlop={{top: 8, bottom: 8, left: 2, right: 2}}
        onPress={onPress}
        onPressIn={handlePressIn}
        testID={item.testID}
        style={({pressed}) => [
          styles.tile,
          isDisabled && styles.disabledTile,
          pressed && !isDisabled && styles.pressedTile,
        ]}
      >
        {/* Tinted icon tile 56x56 with static tilt and border 2 ink */}
        <Animated.View
          style={[styles.iconBox, {backgroundColor}, iconTileAnimStyle]}
        >
          <HomeIcon name={item.icon} size={26} color={ink} />
        </Animated.View>

        <AppText style={styles.title} numberOfLines={2}>
          {titleText}
        </AppText>

        {/* Status line only while something is waiting (§VS-4) */}
        {item.badgeText ? (
          <AppText style={styles.statusLine} numberOfLines={1}>
            {t('home.shortcut_due_status')}
          </AppText>
        ) : null}

        {/* Badge in top-right corner for review when due > 0 (§VS-4) */}
        {item.badgeText ? (
          <View style={styles.badge} testID={`${item.testID}-badge`}>
            <AppText style={styles.badgeText}>{item.badgeText}</AppText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function HomeShortcutsGrid({shortcuts, onPress}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.section} testID="home-shortcuts-section">
      <View style={styles.headerRow}>
        <AppText style={styles.sectionTitle} testID="home-shortcuts-title">
          {t('home.shortcuts_title')}
        </AppText>
        <AppText style={styles.sectionHint} numberOfLines={1}>
          {t('home.shortcuts_hint')}
        </AppText>
      </View>
      <View style={styles.grid} testID="home-shortcuts-grid">
        {shortcuts.map(item => (
          <ShortcutCell
            key={item.key}
            item={item}
            onPress={() => onPress(item.key)}
          />
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: 12,
    },
    headerRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    sectionHint: {
      color: theme.colors.text.secondary,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '600',
    },
    grid: {
      flexDirection: 'row',
      gap: 6,
    },
    cellWrapper: {
      flex: 1,
      minWidth: 0,
    },
    tile: {
      alignItems: 'center',
      gap: 6,
      paddingTop: 4,
      position: 'relative',
    },
    disabledTile: {
      opacity: 0.45,
    },
    pressedTile: {
      transform: [{translateY: 2}],
    },
    iconBox: {
      alignItems: 'center',
      borderRadius: 18,
      height: 56,
      justifyContent: 'center',
      width: 56,
      ...getHardShadow(3, theme.colors.ink),
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    statusLine: {
      color: theme.colors.secondary,
      fontSize: 11,
      fontWeight: '700',
      marginTop: -4,
      textAlign: 'center',
    },
    badge: {
      backgroundColor: theme.colors.secondary,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 1,
      position: 'absolute',
      right: 2,
      top: -4,
    },
    badgeText: {
      color: GRID_PALETTE.badgeText,
      fontSize: 11,
      fontWeight: '800',
    },
  });
}
