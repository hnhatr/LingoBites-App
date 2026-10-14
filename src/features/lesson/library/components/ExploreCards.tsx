import React, {useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {Defs, LinearGradient, Rect, Stop, Svg} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {
  type CoverGlyph,
  Glyph,
  LibraryCover,
  type LibraryCoverProps,
} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {cefrLevelOf, levelTone} from '@ui/theme/levelColors';

import type {LibraryTone} from '../logic/librarySections';
import {stickerCard} from './LibraryShelf';
import {libraryTone} from './libraryTones';

/** Packs this size or smaller show one dot per word instead of a bar. */
export const MAX_PACK_DOTS = 20;

export interface PackCardProps {
  title: string;
  /** Right of the level chip, e.g. "12 từ". */
  sizeLabel: string;
  level: string | null;
  tone: LibraryTone;
  glyph: CoverGlyph;
  imageUrl: string | null;
  downloaded: boolean;
  learned: number;
  total: number;
  /** Line under the progress, e.g. "4/12 đã nhớ" or "Chưa tải". */
  statusLabel: string;
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
}

/**
 * A word pack drawn as a small stack of flashcards: the level, a tilted
 * topic tile (the pack's picture when it has one), the title, one dot per
 * word (filled once learned) and the download state.
 */
export function PackCard({
  title,
  sizeLabel,
  level,
  tone,
  glyph,
  imageUrl,
  downloaded,
  learned,
  total,
  statusLabel,
  onPress,
  accessibilityHint,
  testID,
}: PackCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const colors = libraryTone(theme, tone);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  const chip = cefrLevelOf(level);
  const done = downloaded ? Math.min(Math.max(learned, 0), total) : 0;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={[chip, title, sizeLabel, statusLabel]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.pack, pressed && styles.pressedDown]}
      testID={testID}
    >
      <View style={[styles.layer, styles.layerBack]} />
      <View style={[styles.layer, styles.layerMid]} />
      <View style={styles.face}>
        <View style={styles.packTop}>
          {chip ? <LevelChip level={chip} testID={`${testID}-level`} /> : null}
          <AppText color="muted" style={styles.packSize}>
            {sizeLabel}
          </AppText>
        </View>
        <View style={styles.tileWrap}>
          <View style={[styles.tile, {backgroundColor: colors.strong}]}>
            {showImage ? (
              <Image
                accessibilityIgnoresInvertColors
                onError={() => setFailedUrl(imageUrl)}
                resizeMode="cover"
                source={{uri: imageUrl!}}
                style={StyleSheet.absoluteFill}
                testID={`${testID}-image`}
              />
            ) : (
              <View testID={`${testID}-default`}>
                <Glyph color={colors.onStrong} name={glyph} size={30} />
              </View>
            )}
          </View>
        </View>
        <AppText numberOfLines={1} style={styles.packTitle}>
          {title}
        </AppText>
        {total > 0 && total <= MAX_PACK_DOTS ? (
          <View style={styles.dots}>
            {Array.from({length: total}, (_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index < done && {backgroundColor: colors.strong},
                ]}
              />
            ))}
          </View>
        ) : total > 0 ? (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.strong,
                  width: `${Math.round((done / total) * 100)}%`,
                },
              ]}
            />
          </View>
        ) : null}
        <View style={styles.packStatus}>
          {downloaded && learned === 0 ? (
            <Glyph color={theme.colors.primary} name="check" size={14} />
          ) : !downloaded ? (
            <View testID={`${testID}-status-download`}>
              <Glyph
                color={theme.colors.text.muted}
                name="download"
                size={14}
              />
            </View>
          ) : null}
          <AppText
            numberOfLines={1}
            style={[
              styles.packStatusText,
              {color: downloaded ? colors.ink : theme.colors.text.muted},
            ]}
          >
            {statusLabel}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

export interface VideoCardProps {
  title: string;
  /** Line under the title, e.g. "Video · 3 bài học". */
  meta: string;
  cover: Pick<LibraryCoverProps, 'imageUrl' | 'level' | 'duration'>;
  onPress: () => void;
  testID: string;
}

/** The first video: a wide cover with its title written over the picture. */
export function VideoHeroCard({
  title,
  meta,
  cover,
  onPress,
  testID,
}: VideoCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const yellow = libraryTone(theme, 'yellow');
  const metaLine = [meta, cover.duration].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityHint="Mở video"
      accessibilityLabel={[title, metaLine].join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.heroCard, pressed && styles.pressedDown]}
      testID={testID}
    >
      <View style={styles.clip}>
        <LibraryCover
          glyph="subtitles"
          imageUrl={cover.imageUrl}
          level={cover.level}
          shape="video"
          testID={`${testID}-cover`}
        />
        <Svg
          height="55%"
          pointerEvents="none"
          style={styles.shade}
          width="100%"
        >
          <Defs>
            <LinearGradient id="videoShade" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.75" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#videoShade)" height="100%" width="100%" />
        </Svg>
        <View style={[styles.playBubble, {backgroundColor: yellow.strong}]}>
          <Glyph color={yellow.onStrong} name="play" size={24} />
        </View>
        <View style={styles.caption}>
          <AppText numberOfLines={2} style={styles.captionTitle}>
            {title}
          </AppText>
          <View style={styles.captionMeta}>
            <MaterialIcon
              color={theme.colors.onOverlay}
              name="subtitles"
              size={14}
            />
            <AppText numberOfLines={1} style={styles.captionMetaText}>
              {metaLine}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** A video under the first one: a small thumbnail beside its title. */
export function VideoRowCard({
  title,
  meta,
  cover,
  onPress,
  testID,
}: VideoCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityHint="Mở video"
      accessibilityLabel={[title, meta, cover.duration]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressedDown]}
      testID={testID}
    >
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
      </View>
      <View style={styles.rowText}>
        <AppText numberOfLines={2} style={styles.rowTitle}>
          {title}
        </AppText>
        <View style={styles.meta}>
          <MaterialIcon
            color={theme.colors.text.muted}
            name="subtitles"
            size={13}
          />
          <AppText color="muted" numberOfLines={1} style={styles.metaText}>
            {meta}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

export interface LessonRowCardProps {
  /** "01": the lesson's place in its unit. */
  index: string;
  title: string;
  meta: string | null;
  level: string | null;
  onPress: () => void;
  testID: string;
}

/** A lesson as a line of a contents page: its number, title and length. */
export function LessonRowCard({
  index,
  title,
  meta,
  level,
  onPress,
  testID,
}: LessonRowCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const yellow = libraryTone(theme, 'yellow');
  const chip = cefrLevelOf(level);
  const metaLine = [meta, chip].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityHint="Mở bài học"
      accessibilityLabel={[title, metaLine].filter(Boolean).join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressedDown]}
      testID={testID}
    >
      <View style={[styles.index, {backgroundColor: yellow.strong}]}>
        <AppText style={[styles.indexText, {color: yellow.onStrong}]}>
          {index}
        </AppText>
      </View>
      <View style={styles.rowText}>
        <AppText numberOfLines={1} style={styles.rowTitle}>
          {title}
        </AppText>
        {metaLine ? (
          <View style={styles.meta}>
            <MaterialIcon
              color={theme.colors.text.muted}
              name="schedule"
              size={13}
            />
            <AppText color="muted" numberOfLines={1} style={styles.metaText}>
              {metaLine}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.go}>
        <MaterialIcon
          color={theme.colors.text.primary}
          name="chevron_right"
          size={18}
        />
      </View>
    </Pressable>
  );
}

/** "HỎI ĐƯỜNG - - - -": a unit's name above its lessons. */
export function UnitHeading({title}: {title: string}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.unit}>
      <AppText color="secondary" style={styles.unitText}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.unitRule} />
    </View>
  );
}

function LevelChip({level, testID}: {level: string; testID?: string}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tone = levelTone(theme, level);
  return (
    <View style={[styles.chip, {backgroundColor: tone.strong}]} testID={testID}>
      <AppText style={[styles.chipText, {color: tone.on}]}>{level}</AppText>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const card = stickerCard(theme);
  return StyleSheet.create({
    pressedDown: {
      transform: [{translateY: 2}],
    },
    // Pack
    pack: {
      flex: 1,
    },
    layer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      ...stickerCard(theme, 2),
    },
    layerBack: {
      transform: [{rotate: '6deg'}, {translateX: 5}, {translateY: 2}],
    },
    layerMid: {
      transform: [{rotate: '-4deg'}, {translateX: -3}, {translateY: 1}],
    },
    face: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      gap: 6,
      padding: 10,
      ...card,
    },
    packTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    packSize: {
      fontSize: 11,
      fontWeight: '800',
    },
    tileWrap: {
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    tile: {
      alignItems: 'center',
      borderRadius: 18,
      height: 56,
      justifyContent: 'center',
      overflow: 'hidden',
      transform: [{rotate: '-8deg'}],
      width: 56,
    },
    packTitle: {
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    dots: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2.5,
    },
    dot: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 4,
      height: 7,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
    },
    packStatus: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 3,
    },
    packStatusText: {
      flexShrink: 1,
      fontSize: 11.5,
      fontWeight: '800',
    },
    chip: {
      borderRadius: 6,
      paddingHorizontal: 6,
    },
    chipText: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.4,
      lineHeight: 15,
    },
    // Video
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      ...card,
    },
    clip: {
      borderRadius: 16,
      overflow: 'hidden',
    },
    shade: {
      bottom: 0,
      left: 0,
      position: 'absolute',
    },
    playBubble: {
      alignItems: 'center',
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      paddingLeft: 2,
      position: 'absolute',
      right: 12,
      top: 12,
      width: 44,
      ...card,
    },
    caption: {
      bottom: 10,
      gap: 4,
      left: 12,
      position: 'absolute',
      right: 12,
    },
    captionTitle: {
      color: theme.colors.onOverlay,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 21,
    },
    captionMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    captionMetaText: {
      color: theme.colors.onOverlay,
      fontSize: 12,
      fontWeight: '700',
    },
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: 8,
      paddingRight: 12,
      ...card,
    },
    rowThumb: {
      borderRadius: 11,
      overflow: 'hidden',
      width: 116,
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
      gap: 4,
      minWidth: 0,
    },
    rowTitle: {
      color: theme.colors.text.primary,
      fontSize: 14.5,
      fontWeight: '800',
      lineHeight: 19,
    },
    meta: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    metaText: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
    },
    // Lesson
    index: {
      alignItems: 'center',
      borderRadius: 14,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    indexText: {
      fontSize: 18,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    go: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 15,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    unit: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    unitText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    unitRule: {
      borderColor: theme.colors.outlineVariant,
      borderStyle: 'dashed',
      borderTopWidth: 2,
      flex: 1,
    },
  });
}
