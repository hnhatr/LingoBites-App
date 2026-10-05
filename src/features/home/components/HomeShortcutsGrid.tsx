/**
 * HomeShortcutsGrid — "Lối tắt" section title + 2x2 grid of 4 compact sticker
 * shortcuts (DQ-005, D3, P-003, Gap 7 LING-261).
 *
 * Color mapping matches mockup v4 (Gap 7):
 *   video    → accentSoft / primary
 *   review   → tertiarySoft / onTertiaryContainer
 *   speaking → secondarySoft / secondary
 *   lessons  → surfaceContainer / text.primary
 *
 * Motion (AD-002):
 *   - I6 (sticker wobble/tilt on press): disabled under reduced motion
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {ShortcutItem, ShortcutKey} from '../logic/homeScreenModel';
import {HomeIcon, type HomeSvgIconName} from './HomeSvgIcons';

type Props = {
  shortcuts: ShortcutItem[];
  onPress: (key: ShortcutKey) => void;
};

const ICON_MAP: Record<ShortcutKey, HomeSvgIconName> = {
  review: 'style',
  speaking: 'record_voice_over',
  lessons: 'school',
  video: 'play_circle',
};

// Mockup v4 colors (Gap 7): video=accentSoft, review=tertiarySoft,
// speaking=secondarySoft, lessons=surfaceContainer
const BG_MAP: Record<
  ShortcutKey,
  'accentSoft' | 'tertiarySoft' | 'secondarySoft' | 'surfaceContainer'
> = {
  video: 'accentSoft',
  review: 'tertiarySoft',
  speaking: 'secondarySoft',
  lessons: 'surfaceContainer',
};

const INK_MAP: Record<
  ShortcutKey,
  'primary' | 'onTertiaryContainer' | 'secondary' | 'text.primary'
> = {
  video: 'primary',
  review: 'onTertiaryContainer',
  speaking: 'secondary',
  lessons: 'text.primary',
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

  // I6: tilt/wobble on press — disabled under reduced motion
  const tilt = useSharedValue(0);
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${tilt.value}deg`}],
  }));

  const backgroundColor = theme.colors[BG_MAP[item.key]];
  const inkKey = INK_MAP[item.key];
  const ink =
    inkKey === 'text.primary'
      ? theme.colors.text.primary
      : theme.colors[inkKey];
  const iconName = ICON_MAP[item.key];
  const titleText = t(item.titleKey);
  const metaText =
    item.metaKey && item.metaParams
      ? t(item.metaKey, item.metaParams)
      : item.metaKey
      ? t(item.metaKey)
      : null;

  const isDisabled = item.disabled;
  const a11yLabel = isDisabled
    ? `${titleText}. ${t('home.shortcut_video_locked')}`
    : metaText
    ? `${titleText}. ${metaText}`
    : titleText;

  const shelf = theme.shelf?.surface;

  return (
    <Pressable
      accessibilityLabel={a11yLabel}
      accessibilityRole="button"
      accessibilityState={isDisabled ? {disabled: true} : undefined}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        if (!reducedMotion && !isDisabled) {
          tilt.value = withTiming(3, {duration: 100});
        }
      }}
      onPressOut={() => {
        if (!reducedMotion) {
          tilt.value = withTiming(0, {duration: 150});
        }
      }}
      testID={item.testID}
      style={styles.cellWrap}
    >
      {({pressed}) => (
        <Animated.View style={tiltStyle}>
          <ShelfSurface
            shelfHeight={shelf?.height}
            shelfColor={shelf?.color}
            borderRadius={theme.radius.lg}
            isPressed={pressed}
            isDisabled={isDisabled}
            containerStyle={theme.shadow.soft}
            faceStyle={[
              styles.cell,
              {backgroundColor},
              !shelf && pressed && !isDisabled && styles.pressed,
            ]}
          >
            {/* Icon tile */}
            <View
              style={[styles.iconTile, {backgroundColor: theme.colors.surface}]}
            >
              <HomeIcon name={iconName} size={24} color={ink} />
              {/* Lock overlay for disabled (D3) */}
              {isDisabled ? (
                <View style={styles.lockOverlay}>
                  <HomeIcon
                    name="lock"
                    size={14}
                    color={theme.colors.text.primary}
                  />
                </View>
              ) : null}
            </View>

            <AppText
              variant="label"
              style={[styles.title, {color: ink}]}
              numberOfLines={2}
            >
              {titleText}
            </AppText>

            {metaText ? (
              <AppText
                variant="caption"
                style={[styles.meta, {color: ink}]}
                numberOfLines={1}
              >
                {metaText}
              </AppText>
            ) : null}

            {/* Badge (P-003) */}
            {item.badgeCount != null && item.badgeCount > 0 ? (
              <View
                style={[styles.badge, {backgroundColor: theme.colors.danger}]}
                testID={`${item.testID}-badge`}
              >
                <AppText variant="caption" style={styles.badgeLabel}>
                  {item.badgeCount}
                </AppText>
              </View>
            ) : null}
          </ShelfSurface>
        </Animated.View>
      )}
    </Pressable>
  );
}

export function HomeShortcutsGrid({shortcuts, onPress}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View testID="home-shortcuts-section">
      {/* Section title: "Lối tắt" (Gap 7, mockup v4) */}
      <AppText
        variant="h3"
        style={styles.sectionTitle}
        testID="home-shortcuts-title"
      >
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
    sectionTitle: {
      marginBottom: theme.spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    cellWrap: {
      flexBasis: '47%',
      flexGrow: 1,
      minWidth: 140,
    },
    // Compact sticker tile style (Gap 7: smaller minHeight vs old explore cell)
    cell: {
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      minHeight: 110,
      padding: theme.spacing.md,
    },
    iconTile: {
      alignItems: 'center',
      borderRadius: 12,
      height: 40,
      justifyContent: 'center',
      position: 'relative',
      width: 40,
    },
    lockOverlay: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 8,
      padding: 2,
    },
    title: {},
    meta: {},
    badge: {
      alignSelf: 'flex-start',
      borderRadius: 10,
      minWidth: 20,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeLabel: {
      color: theme.colors.text.inverse,
      textAlign: 'center',
    },
    pressed: {opacity: theme.states.pressedOpacity},
  });
}
