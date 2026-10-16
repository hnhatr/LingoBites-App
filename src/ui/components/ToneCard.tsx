/**
 * ToneCard — a pack or lesson drawn like a Courses card, shared by the
 * Library and the word path list.
 */
import {BlurTargetView} from 'expo-blur';
import React, {useMemo, useRef, useState} from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {Defs, LinearGradient, Rect, Stop, Svg} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import type {GridTileTone} from '@ui/components/GridTile';
import {withAlpha} from '@ui/components/layout';
import {
  type CoverGlyph,
  Glyph,
  LibraryCover,
} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {
  VIDEO_PLAY_SIZE,
  VideoPlayButton,
  VideoSaveButton,
} from '@ui/components/VideoCardButtons';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';

export const CARD_HEIGHT = 168;
/** Share of a card the picture takes, on the right. */
const ART_SHARE = 0.5;
export const CARD_RADIUS = 26;
export const CARD_SHELF_HEIGHT = 5;
/** Where the play button sits across the picture: the part not faded out. */
const PLAY_ACROSS_ART = 0.55;

/** Colours of the tone cards, the same three as the Courses cards. */
export type CardTone = 'accent' | 'tertiary' | 'secondary';

const CARD_TONES: readonly CardTone[] = ['accent', 'tertiary', 'secondary'];

/** Cycles card colours down a list so neighbours differ. */
export function cardToneAt(index: number): CardTone {
  return CARD_TONES[index % CARD_TONES.length];
}

/** Cover face and ink for a tone, matching the Library's sticker tiles. */
export function shelfTone(theme: AppTheme, tone: GridTileTone) {
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

/** The pill on a card, e.g. "Vào học" (solid) or "Tải về" (light). */
export interface CardAction {
  label: string;
  /** Left out for a pill with words only, e.g. "Sắp có". */
  glyph?: 'play' | 'download' | 'check' | 'add';
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
  /** Ignores presses, e.g. while another pack downloads. */
  disabled?: boolean;
  testID: string;
  /** Width of the list's side padding, to size the picture. */
  gutter: number;
  /** Fixed card width, e.g. in a horizontal rail; else the screen's. */
  width?: number;
  /** Save toggle in the top right corner, its own button. */
  bookmark?: {saved: boolean; onToggle: () => void};
  /**
   * A video: a play button over the picture, and the save toggle drawn as a
   * green bookmark in a frosted square.
   */
  video?: boolean;
  /** Under the card, outside its button, e.g. a practice link. */
  footer?: React.ReactNode;
  /** Screen reader actions on the card, e.g. "Gói sau" in a stack. */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
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
  disabled = false,
  testID,
  gutter,
  bookmark,
  footer,
  width: fixedWidth,
  video = false,
  accessibilityActions,
  onAccessibilityAction,
}: ToneCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const [pressed, setPressed] = useState(false);
  const colors = cardColors(theme, tone);
  const cardWidth = fixedWidth ?? width - gutter * 2;
  const artWidth = Math.max(0, cardWidth * ART_SHARE);
  const gradientId = `cardFade-${testID}`;
  const artRef = useRef<View>(null);

  const card = (
    <Pressable
      accessibilityActions={accessibilityActions}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={[eyebrow, title, description, action.label]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={fixedWidth !== undefined ? {width: fixedWidth} : undefined}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={CARD_RADIUS}
        faceStyle={[styles.cardFace, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={CARD_SHELF_HEIGHT}
      >
        <View style={[cardStyles.art, {width: artWidth}]}>
          <BlurTargetView ref={artRef} style={cardStyles.artFill}>
            <LibraryCover
              aspectRatio={artWidth > 0 ? artWidth / CARD_HEIGHT : undefined}
              glyph={cover.glyph}
              hideLevelChip
              imageUrl={cover.imageUrl}
              shape="lesson"
              testID={`${testID}-cover`}
            />
          </BlurTargetView>
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
        {video ? (
          <View
            pointerEvents="none"
            style={[
              cardStyles.play,
              {
                left:
                  cardWidth -
                  artWidth +
                  artWidth * PLAY_ACROSS_ART -
                  VIDEO_PLAY_SIZE.width / 2,
              },
            ]}
            testID={`${testID}-play`}
          >
            <VideoPlayButton ink={colors.ink} />
          </View>
        ) : null}
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
    <View
      style={[
        styles.cardWrap,
        fixedWidth !== undefined ? {width: fixedWidth} : null,
      ]}
    >
      {card}
      {bookmark && video ? (
        <VideoSaveButton
          blurTarget={artRef}
          onToggle={bookmark.onToggle}
          saved={bookmark.saved}
          testID={`${testID}-bookmark`}
        />
      ) : bookmark ? (
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

export function ActionPill({
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
      ) : action.glyph ? (
        <Glyph color={text} name={action.glyph} size={15} />
      ) : null}
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
  play: {
    position: 'absolute',
    top: (CARD_HEIGHT - VIDEO_PLAY_SIZE.height) / 2,
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
  });
}
