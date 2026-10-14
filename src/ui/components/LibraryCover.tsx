import React, {useMemo, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {Circle, Defs, Path, Pattern, Rect, Svg} from 'react-native-svg';

import {type AppTheme, useAppTheme} from '../theme';
import {cefrLevelOf, levelTone} from '../theme/levelColors';
import {AppText} from './AppText';

/**
 * The picture at the top of a Library card. A cover image when the server
 * has one (an admin upload, or a YouTube thumbnail); otherwise, or when the
 * image cannot load (offline, broken link), a default cover drawn in the
 * level colour with a pattern and an icon for the topic. The level chip,
 * duration, play button and corner badge sit on top of either.
 *
 *   pack   1:1   word pack        lesson 4:3   six-step lesson
 *   video  16:9  public video
 */

export type LibraryCoverShape = 'pack' | 'video' | 'lesson';

/** Icons drawn on default covers, Material Icons paths on a 24 grid. */
const GLYPHS = {
  cards:
    'M2.53 19.65l1.34.56v-9.03l-2.43 5.86c-.41 1.02.08 2.19 1.09 2.61zm19.5-3.7L17.07 3.98c-.31-.75-1.04-1.21-1.81-1.23-.26 0-.53.04-.79.15L7.1 5.95c-.75.31-1.21 1.03-1.23 1.8-.01.27.04.54.15.8l4.96 11.97c.31.76 1.05 1.22 1.83 1.23.26 0 .52-.05.77-.15l7.36-3.05c1.02-.42 1.51-1.59 1.09-2.6zM7.88 8.75c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2 11c0 1.1.9 2 2 2h1.45l-3.45-8.34v6.34z',
  chat: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z',
  bag: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',
  food: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
  plane:
    'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  work: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z',
  heart:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  school:
    'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
  subtitles:
    'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z',
  book: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
  play: 'M8 5v14l11-7z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
} as const;

export type CoverGlyph = keyof typeof GLYPHS;

/** Words starting a topic code part (`topic:food-drink`) and their icon. */
const TOPIC_GLYPHS: ReadonlyArray<[RegExp, CoverGlyph]> = [
  [/\b(?:food|drink|eat|restaurant|cafe|coffee|cook|meal)/, 'food'],
  [/\b(?:shop|buy|cloth|price|market|store|money)/, 'bag'],
  [/\b(?:travel|trip|airport|hotel|transport|holiday|direction)/, 'plane'],
  [
    /\b(?:greet|hello|intro|people|family|friend|social|conversation|talk)/,
    'chat',
  ],
  [/\b(?:work|job|office|business|career)/, 'work'],
  [/\b(?:home|house|daily|routine|life)/, 'home'],
  [/\b(?:health|body|doctor|sport|feeling|emotion)/, 'heart'],
  [/\b(?:school|study|education|class|learn)/, 'school'],
];

/** The icon of a word pack's default cover: by topic, else word cards. */
export function topicGlyph(topicCode: string | null | undefined): CoverGlyph {
  const code = topicCode?.toLowerCase() ?? '';
  return TOPIC_GLYPHS.find(([pattern]) => pattern.test(code))?.[1] ?? 'cards';
}

/**
 * A YouTube video's thumbnail. `hqdefault` always exists; it is 4:3 with
 * black bars, which a 16:9 cover crops away.
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

const ASPECT: Record<LibraryCoverShape, number> = {
  pack: 1,
  video: 16 / 9,
  lesson: 4 / 3,
};

export interface LibraryCoverProps {
  shape: LibraryCoverShape;
  /** Cover picture; the default cover shows when absent or broken. */
  imageUrl?: string | null;
  /** CEFR level: colours the default cover and shows the chip. */
  level?: string | null;
  /** Colour by `level` but leave the chip out (the screen already says it). */
  hideLevelChip?: boolean;
  /** Icon on the default cover. */
  glyph: CoverGlyph;
  /** Round corner badge, e.g. downloaded (`check`). */
  badge?: 'check' | 'download' | null;
  /** Video length, bottom right, e.g. "4:37". */
  duration?: string | null;
  /** Centered play button (videos). */
  play?: boolean;
  /** Small label bottom left, e.g. "Unit 4 · Bài 3". */
  tag?: string | null;
  /** Small thumbnail size: smaller chip, no tag, duration or play. */
  compact?: boolean;
  /** Overrides the shape's aspect ratio, e.g. a wide banner in a list. */
  aspectRatio?: number;
  testID?: string;
}

export function LibraryCover({
  shape,
  imageUrl,
  level,
  hideLevelChip = false,
  glyph,
  badge,
  duration,
  play = false,
  tag,
  compact = false,
  aspectRatio,
  testID,
}: LibraryCoverProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme, compact), [theme, compact]);
  const tone = levelTone(theme, level);
  const chip = hideLevelChip ? null : cefrLevelOf(level);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <View
      style={[
        styles.cover,
        {aspectRatio: aspectRatio ?? ASPECT[shape], backgroundColor: tone.soft},
      ]}
      testID={testID}
    >
      {showImage ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setFailedUrl(imageUrl ?? null)}
          resizeMode="cover"
          source={{uri: imageUrl!}}
          style={StyleSheet.absoluteFill}
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <DefaultCover
          color={tone.strong}
          glyph={glyph}
          shape={shape}
          testID={testID ? `${testID}-default` : undefined}
        />
      )}
      {chip ? (
        <View
          style={[styles.chip, {backgroundColor: tone.strong}]}
          testID={testID ? `${testID}-level` : undefined}
        >
          <AppText style={[styles.chipText, {color: tone.on}]}>{chip}</AppText>
        </View>
      ) : null}
      {badge ? (
        <View
          style={styles.badge}
          testID={testID ? `${testID}-badge-${badge}` : undefined}
        >
          <Glyph
            color={
              badge === 'check'
                ? theme.colors.primary
                : theme.colors.text.secondary
            }
            name={badge}
            size={compact ? 12 : 15}
          />
        </View>
      ) : null}
      {play && !compact ? (
        <View style={styles.play}>
          <Glyph color={theme.colors.ink} name="play" size={20} />
        </View>
      ) : null}
      {duration && !compact ? (
        <View style={styles.duration}>
          <AppText style={styles.durationText}>{duration}</AppText>
        </View>
      ) : null}
      {tag && !compact ? (
        <View style={styles.tag}>
          <AppText numberOfLines={1} style={styles.tagText}>
            {tag}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function Glyph({
  name,
  color,
  size,
}: {
  name: CoverGlyph;
  color: string;
  size: number;
}) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no"
      viewBox="0 0 24 24"
      width={size}
    >
      <Path d={GLYPHS[name]} fill={color} />
    </Svg>
  );
}

/**
 * Level-coloured pattern (dots for packs and lessons, stripes for videos)
 * with the icon on a white disc, or bare for videos.
 */
function DefaultCover({
  shape,
  color,
  glyph,
  testID,
}: {
  shape: LibraryCoverShape;
  color: string;
  glyph: CoverGlyph;
  testID?: string;
}) {
  const {theme} = useAppTheme();
  const patternId = `cover-${shape}`;
  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          {shape === 'video' ? (
            <Pattern
              height={22}
              id={patternId}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
              width={22}
            >
              <Rect fill={color} height={22} opacity={0.18} width={10} />
            </Pattern>
          ) : (
            <Pattern
              height={14}
              id={patternId}
              patternUnits="userSpaceOnUse"
              width={14}
            >
              <Circle cx={7} cy={7} fill={color} opacity={0.32} r={1.6} />
            </Pattern>
          )}
        </Defs>
        <Rect fill={`url(#${patternId})`} height="100%" width="100%" />
      </Svg>
      <View style={coverStyles.center}>
        {shape === 'video' ? (
          <Glyph color={color} name={glyph} size={44} />
        ) : (
          <View
            style={[
              coverStyles.disc,
              {
                backgroundColor: theme.colors.surface,
              },
              shape === 'lesson' ? coverStyles.discLesson : null,
            ]}
          >
            <Glyph color={color} name={glyph} size={28} />
          </View>
        )}
      </View>
    </View>
  );
}

const coverStyles = StyleSheet.create({
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  disc: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: 'center',
    width: '52%',
    // Wide banners (course and unit headers) keep the disc a badge, not a wall.
    maxWidth: 96,
  },
  discLesson: {
    width: '40%',
  },
});

function makeStyles(theme: AppTheme, compact: boolean) {
  const inset = compact ? 4 : 8;
  return StyleSheet.create({
    cover: {
      maxWidth: '100%',
      overflow: 'hidden',
      width: '100%',
    },
    chip: {
      borderRadius: compact ? 5 : 8,
      left: inset,
      paddingHorizontal: compact ? 4 : 7,
      paddingVertical: compact ? 0 : 1,
      position: 'absolute',
      top: inset,
    },
    chipText: {
      fontSize: compact ? 10 : 12,
      fontWeight: '800',
      letterSpacing: 0.4,
      lineHeight: compact ? 14 : 16,
    },
    badge: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      height: compact ? 18 : 24,
      justifyContent: 'center',
      position: 'absolute',
      right: inset,
      top: inset,
      width: compact ? 18 : 24,
    },
    play: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      height: 38,
      justifyContent: 'center',
      left: '50%',
      marginLeft: -19,
      marginTop: -19,
      paddingLeft: 2,
      position: 'absolute',
      top: '50%',
      width: 38,
    },
    duration: {
      backgroundColor: theme.colors.overlay,
      borderRadius: 6,
      bottom: inset,
      paddingHorizontal: 6,
      paddingVertical: 1,
      position: 'absolute',
      right: inset,
    },
    durationText: {
      color: theme.colors.onOverlay,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    tag: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      bottom: inset,
      left: inset,
      maxWidth: '80%',
      paddingHorizontal: 6,
      position: 'absolute',
    },
    tagText: {
      color: theme.colors.text.primary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
