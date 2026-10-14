import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Defs, LinearGradient, Rect, Stop, Svg} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {
  type CoverGlyph,
  Glyph,
  LibraryCover,
  type LibraryCoverProps,
} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';

import {shelfTone} from './LibraryShelf';
import type {CardTone} from './libraryTones';

const CARD_HEIGHT = 168;
/** Share of a card the picture takes, on the right. */
const ART_SHARE = 0.5;
const CARD_RADIUS = 26;
const ROW_RADIUS = 22;
const SHELF_HEIGHT = 5;

/** The pill on a card, e.g. "Vào học" (solid) or "Tải về" (light). */
export interface CardAction {
  label: string;
  glyph: 'play' | 'download' | 'check' | 'add';
  /** Ink pill with white text; false draws a white pill with ink text. */
  solid: boolean;
}

/** Face, ink, blob and shelf colours of a card tone, as on the Courses tab. */
export function cardColors(theme: AppTheme, tone: CardTone) {
  const {face, ink} = shelfTone(theme, tone);
  return {
    face,
    ink,
    blob: solidOver(withAlpha(ink, 0.08), face),
    shelf: solidOver(withAlpha(ink, 0.28), face),
  };
}

export interface ToneCardProps {
  title: string;
  /** Small line above the title, e.g. "Hỏi đường · Bài 1". */
  eyebrow?: string | null;
  /** Line under the title, e.g. "12 từ · A1 · Chưa tải". */
  description?: string | null;
  cover: {imageUrl: string | null; glyph: CoverGlyph};
  tone: CardTone;
  action: CardAction;
  accessibilityHint: string;
  onPress: () => void;
  testID: string;
  /** Width of the list's side padding, to size the picture. */
  gutter: number;
  /** Save toggle in the top right corner, its own button. */
  bookmark?: {saved: boolean; onToggle: () => void};
  /** Under the card, outside its button, e.g. a practice link. */
  footer?: React.ReactNode;
}

/**
 * A pack or lesson drawn like a Courses card: title, a line and a pill on a
 * tinted face, the picture (or the default cover) filling the right half
 * and melting into the colour.
 */
export function ToneCard({
  title,
  eyebrow,
  description,
  cover,
  tone,
  action,
  accessibilityHint,
  onPress,
  testID,
  gutter,
  bookmark,
  footer,
}: ToneCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const [pressed, setPressed] = useState(false);
  const colors = cardColors(theme, tone);
  const artWidth = Math.max(0, (width - gutter * 2) * ART_SHARE);
  const gradientId = `cardFade-${testID}`;

  const card = (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={[eyebrow, title, description, action.label]
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
        faceStyle={[styles.cardFace, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={SHELF_HEIGHT}
      >
        <View style={[cardStyles.art, {width: artWidth}]}>
          <View style={cardStyles.artFill}>
            <LibraryCover
              aspectRatio={artWidth > 0 ? artWidth / CARD_HEIGHT : undefined}
              glyph={cover.glyph}
              hideLevelChip
              imageUrl={cover.imageUrl}
              shape="lesson"
              testID={`${testID}-cover`}
            />
          </View>
          <Svg
            height={CARD_HEIGHT}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width={artWidth}
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                <Stop offset="0" stopColor={colors.face} stopOpacity={1} />
                <Stop offset="0.45" stopColor={colors.face} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect fill={`url(#${gradientId})`} height="100%" width="100%" />
          </Svg>
        </View>
        <View
          pointerEvents="none"
          style={[styles.blob, {backgroundColor: colors.blob}]}
        />
        <View style={cardStyles.copy}>
          {eyebrow ? (
            <AppText
              numberOfLines={1}
              style={[styles.eyebrow, {color: colors.ink}]}
            >
              {eyebrow.toUpperCase()}
            </AppText>
          ) : null}
          <AppText numberOfLines={2} style={styles.cardTitle}>
            {title}
          </AppText>
          {description ? (
            <AppText
              color="secondary"
              numberOfLines={2}
              style={styles.description}
              testID={`${testID}-description`}
            >
              {description}
            </AppText>
          ) : null}
          <ActionPill
            action={action}
            ink={colors.ink}
            testID={`${testID}-action`}
          />
        </View>
      </ShelfSurface>
    </Pressable>
  );
  if (!bookmark && !footer) return card;
  return (
    <View style={styles.cardWrap}>
      {card}
      {bookmark ? (
        <Pressable
          accessibilityHint={
            bookmark.saved
              ? 'Bỏ bài khỏi danh sách đã lưu'
              : 'Thêm bài vào danh sách đã lưu'
          }
          accessibilityLabel={bookmark.saved ? 'Bỏ lưu bài' : 'Lưu bài'}
          accessibilityRole="button"
          accessibilityState={{selected: bookmark.saved}}
          hitSlop={6}
          onPress={bookmark.onToggle}
          style={styles.bookmark}
          testID={`${testID}-bookmark`}
        >
          <MaterialIcon
            color={colors.ink}
            name={bookmark.saved ? 'bookmark' : 'bookmark_add'}
            size={20}
          />
        </Pressable>
      ) : null}
      {footer}
    </View>
  );
}

export interface VideoCardProps {
  title: string;
  /** Line under the title, e.g. "Video · 3 bài học". */
  meta: string;
  cover: Pick<LibraryCoverProps, 'imageUrl' | 'level' | 'duration'>;
  tone: CardTone;
  onPress: () => void;
  testID: string;
}

/** The first video: its whole thumbnail, then the title and a "Xem" pill. */
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
        shelfHeight={SHELF_HEIGHT}
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
        </View>
        <View style={styles.heroFoot}>
          <View style={styles.rowText}>
            <AppText numberOfLines={2} style={styles.heroTitle}>
              {title}
            </AppText>
            <AppText color="secondary" numberOfLines={1} style={styles.meta}>
              {meta}
            </AppText>
          </View>
          <ActionPill
            action={{label: 'Xem', glyph: 'play', solid: true}}
            ink={colors.ink}
          />
        </View>
      </ShelfSurface>
    </Pressable>
  );
}

/** A video under the first one: its thumbnail beside the title. */
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
        shelfHeight={SHELF_HEIGHT}
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
        </View>
        <View style={styles.rowText}>
          <AppText numberOfLines={2} style={styles.rowTitle}>
            {title}
          </AppText>
          <AppText color="secondary" numberOfLines={1} style={styles.meta}>
            {meta}
          </AppText>
        </View>
        <View style={[styles.playDisc, {backgroundColor: colors.ink}]}>
          <Glyph color={theme.colors.text.inverse} name="play" size={16} />
        </View>
      </ShelfSurface>
    </Pressable>
  );
}

function ActionPill({
  action,
  ink,
  testID,
}: {
  action: CardAction;
  ink: string;
  testID?: string;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const fill = action.solid ? ink : theme.colors.surface;
  const text = action.solid ? theme.colors.text.inverse : ink;
  return (
    <View style={[styles.pill, {backgroundColor: fill}]} testID={testID}>
      {action.glyph === 'add' ? (
        <MaterialIcon color={text} name="add" size={16} />
      ) : (
        <Glyph color={text} name={action.glyph} size={15} />
      )}
      <AppText style={[styles.pillText, {color: text}]}>{action.label}</AppText>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  art: {
    bottom: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  artFill: {
    height: CARD_HEIGHT,
  },
  copy: {
    gap: 4,
    justifyContent: 'center',
    minHeight: CARD_HEIGHT,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 14,
    width: '58%',
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // A soft circle behind the title, as on the Courses cards.
    blob: {
      borderRadius: 70,
      height: 140,
      left: -40,
      position: 'absolute',
      top: -50,
      width: 140,
    },
    cardWrap: {
      gap: theme.spacing.xs,
    },
    bookmark: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      position: 'absolute',
      right: 10,
      top: 10,
      width: 36,
    },
    cardFace: {
      height: CARD_HEIGHT,
      overflow: 'hidden',
    },
    eyebrow: {
      fontSize: 11.5,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    cardTitle: {
      color: theme.colors.text.primary,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 24,
    },
    description: {
      fontSize: 12.5,
      lineHeight: 17,
    },
    pill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 4,
      marginTop: 6,
      paddingLeft: 8,
      paddingRight: 12,
      paddingVertical: 5,
    },
    pillText: {
      fontSize: 12.5,
      fontWeight: '800',
      lineHeight: 16,
    },
    // Video
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
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
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
    playDisc: {
      alignItems: 'center',
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      paddingLeft: 2,
      width: 36,
    },
  });
}
