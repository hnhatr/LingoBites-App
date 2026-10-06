/**
 * HomeShortcutsGrid — "Lối tắt" section title + 2x2 grid of 4 compact sticker
 * shortcuts (LING-256, LING-267, §VS-4).
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
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        onPress={onPress}
        onPressIn={handlePressIn}
        testID={item.testID}
        style={({pressed}) => [
          styles.tile,
          {backgroundColor},
          isDisabled && styles.disabledTile,
          pressed && !isDisabled && styles.pressedTile,
        ]}
      >
        {/* Icon box 44x44 with static tilt and border 2 ink */}
        <Animated.View style={[styles.iconBox, iconTileAnimStyle]}>
          <HomeIcon name={item.icon} size={24} color={ink} />
        </Animated.View>

        {/* Title: 15pt weight 700 */}
        <AppText style={[styles.title, {color: ink}]} numberOfLines={2}>
          {titleText}
        </AppText>

        {/* Sub-line: 12pt weight 600 */}
        <AppText style={[styles.subLine, {color: ink}]} numberOfLines={2}>
          {subText}
        </AppText>

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
      <AppText style={styles.sectionTitle} testID="home-shortcuts-title">
        {t('home.shortcuts_title')}
      </AppText>
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
      gap: 10,
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    cellWrapper: {
      flexBasis: '47%',
      flexGrow: 1,
      minWidth: 140,
    },
    tile: {
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      gap: 6,
      minHeight: 118,
      padding: 14,
      position: 'relative',
      ...getHardShadow(4, theme.colors.ink),
    },
    disabledTile: {
      opacity: 0.45,
      ...getHardShadow(2, theme.colors.ink),
    },
    pressedTile: {
      transform: [{translateY: 3}],
      ...getHardShadow(1, theme.colors.ink),
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
    subLine: {
      fontSize: 12,
      fontWeight: '600',
      opacity: 0.85,
    },
    badge: {
      backgroundColor: theme.colors.secondary,
      borderColor: theme.colors.ink,
      borderRadius: 999,
      borderWidth: 2,
      paddingHorizontal: 9,
      paddingVertical: 3,
      position: 'absolute',
      right: 10,
      top: 10,
    },
    badgeText: {
      color: GRID_PALETTE.badgeText,
      fontSize: 12,
      fontWeight: '800',
    },
  });
}
