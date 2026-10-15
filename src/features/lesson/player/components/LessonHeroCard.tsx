/**
 * LessonHeroCard — the top of the lesson hub, drawn like the Library's
 * "Khám phá" cards (ToneCard): a tinted face, the cover filling the right
 * half and melting into the colour, the copy on the left.
 *
 *   NỀN TẢNG PHÁT ÂM                       [cover]
 *   IPA là gì và cách đọc phiên âm
 *   ◷ 8 phút  ▤ 9 câu  ▣ 25 từ & cụm
 *   Vì sao cần IPA, mỗi ký hiệu là một âm…
 */
import React, {useMemo} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {Defs, LinearGradient, Rect, Stop, Svg} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {type CoverGlyph, LibraryCover} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {
  CARD_RADIUS,
  CARD_SHELF_HEIGHT,
  cardColors,
} from '@ui/components/ToneCard';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';

const ART_HEIGHT = 150;
/** Share of the card the cover takes, on the right. */
const ART_SHARE = 0.55;

export type LessonHeroMeta = {icon: HandoffIconName; label: string};

type Props = {
  title: string;
  /** Small line above the title, e.g. the level; hidden when null. */
  eyebrow: string | null;
  meta: LessonHeroMeta[];
  description: string | null;
  imageUrl: string | null;
  glyph: CoverGlyph;
  testID?: string;
};

export function LessonHeroCard({
  title,
  eyebrow,
  meta,
  description,
  imageUrl,
  glyph,
  testID = 'lesson-hero',
}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const colors = cardColors(theme, 'accent');
  const artWidth = Math.max(0, (width - theme.gutter * 2) * ART_SHARE);

  return (
    <ShelfSurface
      borderRadius={CARD_RADIUS}
      containerTestID={testID}
      faceStyle={[styles.face, {backgroundColor: colors.face}]}
      shelfColor={colors.shelf}
      shelfHeight={CARD_SHELF_HEIGHT}
    >
      <View
        // Decoration: the title says what the lesson is.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.art, {width: artWidth}]}
      >
        <LibraryCover
          aspectRatio={artWidth > 0 ? artWidth / ART_HEIGHT : undefined}
          glyph={glyph}
          hideLevelChip
          imageUrl={imageUrl}
          shape="lesson"
          testID={`${testID}-cover`}
        />
        <Svg
          height={ART_HEIGHT}
          style={StyleSheet.absoluteFill}
          width={artWidth}
        >
          <Defs>
            <LinearGradient id="lessonHeroFadeX" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor={colors.face} stopOpacity={1} />
              <Stop offset="0.5" stopColor={colors.face} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="lessonHeroFadeY" x1="0" x2="0" y1="1" y2="0">
              <Stop offset="0" stopColor={colors.face} stopOpacity={1} />
              <Stop offset="0.45" stopColor={colors.face} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#lessonHeroFadeX)" height="100%" width="100%" />
          <Rect fill="url(#lessonHeroFadeY)" height="100%" width="100%" />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        style={[styles.blob, {backgroundColor: colors.blob}]}
      />
      <View style={styles.copy}>
        {eyebrow ? (
          <AppText
            numberOfLines={1}
            style={[styles.eyebrow, {color: colors.ink}]}
            testID={`${testID}-eyebrow`}
          >
            {eyebrow.toUpperCase()}
          </AppText>
        ) : null}
        <AppText
          numberOfLines={3}
          style={styles.title}
          testID="canonical-hub-title"
        >
          {title}
        </AppText>
        {meta.length > 0 ? (
          <View style={styles.meta}>
            {meta.map(item => (
              <View
                key={item.icon}
                style={styles.metaItem}
                testID={`${testID}-meta-${item.icon}`}
              >
                <MaterialIcon
                  color={theme.colors.text.secondary}
                  name={item.icon}
                  size={15}
                />
                <AppText color="secondary" style={styles.metaText}>
                  {item.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {description ? (
          <AppText
            color="secondary"
            style={styles.description}
            testID={`${testID}-description`}
          >
            {description}
          </AppText>
        ) : null}
      </View>
    </ShelfSurface>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    face: {
      minHeight: ART_HEIGHT,
      overflow: 'hidden',
    },
    art: {
      height: ART_HEIGHT,
      overflow: 'hidden',
      position: 'absolute',
      right: 0,
      top: 0,
    },
    // A soft circle behind the copy, as on the Library cards.
    blob: {
      borderRadius: 85,
      bottom: -60,
      height: 170,
      left: -40,
      position: 'absolute',
      width: 170,
    },
    copy: {
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    eyebrow: {
      fontSize: 11.5,
      fontWeight: '800',
      letterSpacing: 1,
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 27,
      width: '64%',
    },
    meta: {
      columnGap: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 4,
      width: '66%',
    },
    metaItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    metaText: {
      fontSize: 13,
      fontWeight: '700',
    },
    description: {
      fontSize: 13.5,
      lineHeight: 19,
      marginTop: 10,
    },
  });
}
