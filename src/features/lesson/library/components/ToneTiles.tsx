import React, {useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {cardColors} from './ExploreCards';
import type {CardTone} from './libraryTones';

const RADIUS = 22;
const SHELF_HEIGHT = 5;

export interface KindCardProps {
  title: string;
  icon: HandoffIconName;
  tone: CardTone;
  count: number;
  /** The first few items, drawn as white chips. */
  items: string[];
  /** Line shown in place of the chips when there is nothing yet. */
  emptyText?: string;
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
}

/**
 * A saved kind (words, grammar, sentence sets) as a tinted card: an ink
 * icon disc, the name and count, then a few of its items as chips.
 */
export function KindCard({
  title,
  icon,
  tone,
  count,
  items,
  emptyText,
  onPress,
  accessibilityHint,
  testID,
}: KindCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const colors = cardColors(theme, tone);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`${title}. ${count}`}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={RADIUS}
        faceStyle={[styles.kindFace, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={SHELF_HEIGHT}
      >
        <View
          pointerEvents="none"
          style={[styles.blobTop, {backgroundColor: colors.blob}]}
        />
        <View style={styles.kindHead}>
          <View style={[styles.disc, {backgroundColor: colors.ink}]}>
            <MaterialIcon
              color={theme.colors.text.inverse}
              name={icon}
              size={20}
            />
          </View>
          <AppText style={styles.kindTitle}>{title}</AppText>
          <AppText
            style={[styles.kindCount, {color: colors.ink}]}
            testID={`${testID}-count`}
          >
            {count}
          </AppText>
          <MaterialIcon color={colors.ink} name="chevron_right" size={22} />
        </View>
        {items.length > 0 ? (
          <View style={styles.chips}>
            {items.map((item, index) => (
              <View key={`${item}-${index}`} style={styles.chip}>
                <AppText numberOfLines={1} style={styles.chipText}>
                  {item}
                </AppText>
              </View>
            ))}
          </View>
        ) : emptyText ? (
          <AppText color="secondary" style={styles.emptyText}>
            {emptyText}
          </AppText>
        ) : null}
      </ShelfSurface>
    </Pressable>
  );
}

export interface ActionTileProps {
  title: string;
  /** Short line under the title, e.g. "Dán link video". */
  description: string;
  icon: HandoffIconName;
  tone: CardTone;
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
}

/** A way to start something new: an ink disc, a title and one line. */
export function ActionTile({
  title,
  description,
  icon,
  tone,
  onPress,
  accessibilityHint,
  testID,
}: ActionTileProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const colors = cardColors(theme, tone);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.grow}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={RADIUS}
        faceStyle={[styles.tileFace, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={SHELF_HEIGHT}
      >
        <View
          pointerEvents="none"
          style={[styles.blobBottom, {backgroundColor: colors.blob}]}
        />
        <View
          style={[styles.disc, styles.discLarge, {backgroundColor: colors.ink}]}
        >
          <MaterialIcon
            color={theme.colors.text.inverse}
            name={icon}
            size={22}
          />
        </View>
        <View style={styles.tileText}>
          <AppText numberOfLines={1} style={styles.tileTitle}>
            {title}
          </AppText>
          <AppText color="secondary" numberOfLines={2} style={styles.small}>
            {description}
          </AppText>
        </View>
      </ShelfSurface>
    </Pressable>
  );
}

export interface PhotoCardProps {
  title: string;
  imageUri: string | null;
  /** Shown on the tinted square when there is no photo. */
  icon: HandoffIconName;
  tone: CardTone;
  width: number;
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
}

/** A moment in the grid: its whole photo on a tinted card, then its title. */
export function PhotoCard({
  title,
  imageUri,
  icon,
  tone,
  width,
  onPress,
  accessibilityHint,
  testID,
}: PhotoCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const colors = cardColors(theme, tone);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{width}}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={RADIUS}
        faceStyle={[styles.photoFace, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={SHELF_HEIGHT}
      >
        <View
          pointerEvents="none"
          style={[styles.blobBottom, {backgroundColor: colors.blob}]}
        />
        {imageUri ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{uri: imageUri}}
            style={styles.photo}
            testID={`${testID}-photo`}
          />
        ) : (
          <View
            style={[
              styles.photo,
              styles.photoEmpty,
              {backgroundColor: colors.blob},
            ]}
          >
            <MaterialIcon color={colors.ink} name={icon} size={36} />
          </View>
        )}
        <AppText numberOfLines={2} style={styles.photoTitle}>
          {title}
        </AppText>
      </ShelfSurface>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    grow: {
      flex: 1,
    },
    // Soft circles, as on the Courses cards.
    blobTop: {
      borderRadius: 55,
      height: 110,
      position: 'absolute',
      right: -30,
      top: -40,
      width: 110,
    },
    blobBottom: {
      borderRadius: 55,
      bottom: -40,
      height: 110,
      position: 'absolute',
      right: -36,
      width: 110,
    },
    disc: {
      alignItems: 'center',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    discLarge: {
      borderRadius: 22,
      height: 44,
      width: 44,
    },
    // Kind
    kindFace: {
      gap: theme.spacing.md,
      overflow: 'hidden',
      padding: 14,
    },
    kindHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    kindTitle: {
      color: theme.colors.text.primary,
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
    },
    kindCount: {
      fontSize: 22,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      maxWidth: '100%',
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    chipText: {
      color: theme.colors.text.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    emptyText: {
      fontSize: 13,
      fontWeight: '600',
    },
    // Action tile
    tileFace: {
      gap: theme.spacing.md - 2,
      minHeight: 132,
      overflow: 'hidden',
      padding: 14,
    },
    tileText: {
      gap: 2,
    },
    tileTitle: {
      color: theme.colors.text.primary,
      fontSize: 17,
      fontWeight: '800',
    },
    small: {
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 17,
    },
    // Photo card
    photoFace: {
      gap: theme.spacing.sm,
      overflow: 'hidden',
      padding: 6,
      paddingBottom: 12,
    },
    photo: {
      aspectRatio: 1,
      borderRadius: 17,
      width: '100%',
    },
    photoEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoTitle: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
      paddingHorizontal: 6,
    },
  });
}
