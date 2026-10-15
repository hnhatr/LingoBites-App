import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {
  Glyph,
  LibraryCover,
  type LibraryCoverProps,
} from '@ui/components/LibraryCover';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {
  CARD_RADIUS,
  CARD_SHELF_HEIGHT,
  cardColors,
  type CardTone,
} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

export {
  type CardAction,
  cardColors,
  ToneCard,
  type ToneCardProps,
} from '@ui/components/ToneCard';

const ROW_RADIUS = 22;

export interface VideoCardProps {
  title: string;
  /** Line under the title, e.g. "3 bài học"; hidden when empty. */
  meta?: string | null;
  cover: Pick<LibraryCoverProps, 'imageUrl' | 'level' | 'duration'>;
  tone: CardTone;
  onPress: () => void;
  testID: string;
}

/** The first video: its whole thumbnail with a play disc, then the title. */
export function VideoHeroCard({
  title,
  meta,
  cover,
  tone,
  onPress,
  testID,
}: VideoCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const colors = cardColors(theme, tone);

  return (
    <Pressable
      accessibilityHint="Mở video"
      accessibilityLabel={[title, meta, cover.duration]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={CARD_RADIUS}
        faceStyle={[styles.heroFace, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={CARD_SHELF_HEIGHT}
      >
        <View
          pointerEvents="none"
          style={[styles.heroBlob, {backgroundColor: colors.blob}]}
        />
        <View style={styles.heroThumb}>
          <LibraryCover
            duration={cover.duration}
            glyph="subtitles"
            imageUrl={cover.imageUrl}
            level={cover.level}
            shape="video"
            testID={`${testID}-cover`}
          />
          <PlayButton size="large" />
        </View>
        <View style={styles.heroFoot}>
          <AppText numberOfLines={2} style={styles.heroTitle}>
            {title}
          </AppText>
          {meta ? (
            <AppText color="secondary" numberOfLines={1} style={styles.meta}>
              {meta}
            </AppText>
          ) : null}
        </View>
      </ShelfSurface>
    </Pressable>
  );
}

/** A video under the first one: its thumbnail (with a play disc) beside the title. */
export function VideoRowCard({
  title,
  meta,
  cover,
  tone,
  onPress,
  testID,
}: VideoCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const colors = cardColors(theme, tone);

  return (
    <Pressable
      accessibilityHint="Mở video"
      accessibilityLabel={[title, meta, cover.duration]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={ROW_RADIUS}
        faceStyle={[styles.rowFace, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={CARD_SHELF_HEIGHT}
      >
        <View
          pointerEvents="none"
          style={[styles.rowBlob, {backgroundColor: colors.blob}]}
        />
        <View style={styles.rowThumb}>
          <LibraryCover
            compact
            glyph="subtitles"
            imageUrl={cover.imageUrl}
            level={cover.level}
            shape="video"
            testID={`${testID}-cover`}
          />
          {cover.duration ? (
            <View style={styles.duration}>
              <AppText style={styles.durationText}>{cover.duration}</AppText>
            </View>
          ) : null}
          <PlayButton size="small" />
        </View>
        <View style={styles.rowText}>
          <AppText numberOfLines={2} style={styles.rowTitle}>
            {title}
          </AppText>
          {meta ? (
            <AppText color="secondary" numberOfLines={1} style={styles.meta}>
              {meta}
            </AppText>
          ) : null}
        </View>
      </ShelfSurface>
    </Pressable>
  );
}

const PLAY_BUTTON_SIZES = {
  large: {width: 72, height: 50, radius: 10, shelf: 5, glyph: 34},
  small: {width: 44, height: 30, radius: 7, shelf: 3, glyph: 22},
} as const;

/** Light glass for the YouTube-like play button over a thumbnail. */
const PLAY_GLASS = {
  face: 'rgba(255,255,255,0.3)',
  shelf: 'rgba(255,255,255,0.55)',
};

/**
 * The see-through play button centred over a video thumbnail, with a shelf
 * under it like the cards. The face and the shelf don't overlap, so the
 * translucent colours don't stack.
 */
function PlayButton({size}: {size: keyof typeof PLAY_BUTTON_SIZES}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {width, height, radius, shelf, glyph} = PLAY_BUTTON_SIZES[size];

  return (
    <View pointerEvents="none" style={styles.playLayer}>
      <View
        style={[
          styles.playFace,
          {
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            height,
            width,
          },
        ]}
      >
        <View style={styles.playGlyph}>
          <Glyph color={theme.colors.text.inverse} name="play" size={glyph} />
        </View>
      </View>
      <View
        style={[
          styles.playShelf,
          {
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
            height: shelf,
            width,
          },
        ]}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    heroFace: {
      overflow: 'hidden',
      padding: 8,
    },
    heroBlob: {
      borderRadius: 80,
      bottom: -60,
      height: 160,
      position: 'absolute',
      right: -50,
      width: 160,
    },
    heroThumb: {
      borderRadius: 19,
      overflow: 'hidden',
    },
    heroFoot: {
      gap: 2,
      paddingBottom: 6,
      paddingLeft: 10,
      paddingRight: 6,
      paddingTop: 12,
    },
    heroTitle: {
      color: theme.colors.text.primary,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
    },
    rowFace: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      overflow: 'hidden',
      padding: 10,
      paddingRight: 12,
    },
    rowBlob: {
      borderRadius: 55,
      height: 110,
      position: 'absolute',
      right: -30,
      top: -40,
      width: 110,
    },
    rowThumb: {
      borderRadius: 14,
      overflow: 'hidden',
      width: 128,
    },
    duration: {
      backgroundColor: theme.colors.overlay,
      borderRadius: 5,
      bottom: 5,
      paddingHorizontal: 5,
      position: 'absolute',
      right: 5,
    },
    durationText: {
      color: theme.colors.onOverlay,
      fontSize: 10.5,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    rowText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    rowTitle: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
    },
    meta: {
      fontSize: 12.5,
      fontWeight: '600',
    },
    playLayer: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playFace: {
      alignItems: 'center',
      backgroundColor: PLAY_GLASS.face,
      justifyContent: 'center',
      paddingLeft: 2,
    },
    // Keeps the white triangle readable on bright thumbnails (iOS only).
    playGlyph: {
      shadowColor: theme.colors.overlay,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 1,
      shadowRadius: 2,
    },
    playShelf: {
      backgroundColor: PLAY_GLASS.shelf,
    },
  });
}
