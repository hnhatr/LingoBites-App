import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {type CoverGlyph, LibraryCover} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';

/** Card colour, cycled down the list so neighbours differ. */
export type CourseCardTone = 'accent' | 'tertiary' | 'secondary';

const TONES: CourseCardTone[] = ['accent', 'tertiary', 'secondary'];

export function courseCardToneAt(index: number): CourseCardTone {
  return TONES[index % TONES.length];
}

const HEIGHT = 168;
/** Share of the card the picture takes, on the right. */
const ART_SHARE = 0.5;
const RADIUS = 26;

type Props = {
  title: string;
  description?: string;
  imageUrl?: string | null;
  glyph: CoverGlyph;
  tone: CourseCardTone;
  locked?: boolean;
  /** Pill label, e.g. "Vào học" or "Cần mở khóa". */
  actionLabel: string;
  accessibilityHint: string;
  onPress: () => void;
  testID: string;
  coverTestID: string;
  /** Width of the list's side padding, to size the picture. */
  gutter: number;
};

/**
 * One course as a short coloured card: title, blurb and a "start" pill on a
 * tinted face, the course picture filling the right half and melting into
 * the colour. Tones cycle down the list.
 */
export function CourseCard({
  title,
  description,
  imageUrl,
  glyph,
  tone,
  locked = false,
  actionLabel,
  accessibilityHint,
  onPress,
  testID,
  coverTestID,
  gutter,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const [pressed, setPressed] = useState(false);
  const colors = toneColors(theme, tone);
  const artWidth = Math.max(0, (width - gutter * 2) * ART_SHARE);
  const gradientId = `courseFade-${testID}`;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
    >
      <ShelfSurface
        borderRadius={RADIUS}
        faceStyle={[themedStyles.face, {backgroundColor: colors.face}]}
        isPressed={pressed}
        shelfColor={colors.shelf}
        shelfHeight={5}
      >
        <View
          style={[styles.art, {width: artWidth}]}
          testID={`${testID}-cover`}
        >
          <View style={styles.artFill}>
            <LibraryCover
              aspectRatio={artWidth > 0 ? artWidth / HEIGHT : undefined}
              glyph={glyph}
              hideLevelChip
              imageUrl={imageUrl}
              shape="lesson"
              testID={coverTestID}
            />
          </View>
          <Svg
            height={HEIGHT}
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
          style={[themedStyles.blob, {backgroundColor: colors.blob}]}
        />
        <View style={styles.copy}>
          <AppText numberOfLines={2} style={themedStyles.title}>
            {title}
          </AppText>
          {description && description.trim().length > 0 ? (
            <AppText
              color="secondary"
              ellipsizeMode="tail"
              numberOfLines={2}
              style={themedStyles.description}
            >
              {description}
            </AppText>
          ) : null}
          <View
            style={[
              themedStyles.pill,
              {backgroundColor: locked ? theme.colors.surface : colors.ink},
            ]}
          >
            <MaterialIcon
              color={locked ? colors.ink : theme.colors.text.inverse}
              name={locked ? 'lock' : 'play_arrow'}
              size={16}
            />
            <AppText
              style={[
                themedStyles.pillText,
                {color: locked ? colors.ink : theme.colors.text.inverse},
              ]}
            >
              {actionLabel}
            </AppText>
          </View>
        </View>
      </ShelfSurface>
    </Pressable>
  );
}

function toneColors(theme: AppTheme, tone: CourseCardTone) {
  const {colors} = theme;
  const pick = {
    accent: {soft: colors.accentSoft, ink: colors.primary},
    tertiary: {soft: colors.tertiarySoft, ink: colors.onTertiaryContainer},
    secondary: {soft: colors.secondarySoft, ink: colors.secondary},
  }[tone];
  const face = solidOver(pick.soft, colors.surface);
  return {
    face,
    ink: pick.ink,
    blob: solidOver(withAlpha(pick.ink, 0.08), face),
    shelf: solidOver(withAlpha(pick.ink, 0.28), face),
  };
}

const styles = StyleSheet.create({
  art: {
    bottom: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  artFill: {
    height: HEIGHT,
  },
  copy: {
    gap: 4,
    justifyContent: 'center',
    minHeight: HEIGHT,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 14,
    width: '58%',
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // A soft circle behind the title, a little sticker-book flourish.
    blob: {
      borderRadius: 70,
      height: 140,
      left: -40,
      position: 'absolute',
      top: -50,
      width: 140,
    },
    description: {
      fontSize: 12.5,
      lineHeight: 17,
    },
    face: {
      height: HEIGHT,
      overflow: 'hidden',
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
    title: {
      color: theme.colors.text.primary,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 24,
    },
  });
}
