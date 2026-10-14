/**
 * PackHeroCard — the bright card at the top of a word pack.
 *
 * The same mint-to-sky face as Home's "Hôm nay" card, with the default vocab
 * picture fading in on the right:
 *   [A1 · Mới bắt đầu] [Gói từ]                 [picture]
 *   Daily life
 *   12 từ
 *   [ Đã nhớ                         3/12 ]   white strip
 *   [ ███████░░░░░░░░░░░░░░░░░░░░░░░░░░ ]
 *   [ ▶ Học tiếp (9 mục) ] [ Kiểm tra nhanh ]
 *                          [ Bỏ qua từ đã biết ]
 */
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';
import Svg, {
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Mask,
  Rect,
  Stop,
} from 'react-native-svg';

import {DEFAULT_COVERS} from '@ui/assets/covers';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';

/** The card keeps its own colours in every theme, as Home's card does. */
export const PACK_PALETTE = {
  faceFrom: '#34dcc3',
  faceTo: '#5fc8ff',
  shelf: '#1fa597',
  ink: '#1c1c10',
  tealInk: '#00413a',
  teal: '#006b5f',
  white: '#ffffff',
  chip: 'rgba(255,255,255,0.88)',
  strip: 'rgba(255,255,255,0.88)',
  track: '#dfeee9',
  coral: '#fe7488',
  coralShelf: '#e2506a',
  sun: '#ffd166',
  ghostShelf: 'rgba(0,74,65,0.25)',
};

const ART_HEIGHT = 150;

type Props = {
  /** "A1 · Mới bắt đầu"; hidden when null. */
  levelLabel: string | null;
  kindLabel: string;
  title: string;
  /** "12 từ · 2 cụm từ". */
  subtitle: string;
  learned: number;
  total: number;
  learnTitle: string;
  onLearn: () => void;
  /** Hidden once every item is learned. */
  onCheck?: () => void;
};

export function PackHeroCard({
  levelLabel,
  kindLabel,
  title,
  subtitle,
  learned,
  total,
  learnTitle,
  onLearn,
  onCheck,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [learnDown, setLearnDown] = useState(false);
  const share = total > 0 ? Math.min(1, learned / total) : 0;

  return (
    <ShelfSurface
      borderRadius={26}
      containerTestID="word-pack-summary"
      faceStyle={styles.face}
      shelfColor={PACK_PALETTE.shelf}
      shelfHeight={6}
    >
      <HeroBackground styles={styles} />
      <View style={styles.inner}>
        <View style={styles.chips}>
          {levelLabel ? (
            <View style={[styles.chip, styles.levelChip]}>
              <AppText style={styles.chipText}>{levelLabel}</AppText>
            </View>
          ) : null}
          <View style={styles.chip} testID="word-pack-kind">
            <AppText style={[styles.chipText, styles.kindText]}>
              {kindLabel}
            </AppText>
          </View>
        </View>
        <View style={styles.copy}>
          <AppText numberOfLines={2} style={styles.title}>
            {title}
          </AppText>
          <AppText numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </AppText>
        </View>

        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            text: t('wordPack.learned_a11y', {learned, total}),
          }}
          accessible
          style={styles.strip}
          testID="word-pack-progress"
        >
          <View style={styles.stripRow}>
            <AppText style={styles.stripLabel}>
              {t('wordPack.stat_learned_label')}
            </AppText>
            <View style={styles.count}>
              <AppText
                style={styles.countText}
                testID="word-pack-learned-count"
              >
                {learned}
              </AppText>
              <AppText style={styles.countText}>{`/${total}`}</AppText>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, {width: `${share * 100}%`}]} />
          </View>
        </View>

        <View style={styles.ctas}>
          <Pressable
            accessibilityHint={t('wordPack.learn_hint')}
            accessibilityLabel={learnTitle}
            accessibilityRole="button"
            onPress={onLearn}
            onPressIn={() => setLearnDown(true)}
            onPressOut={() => setLearnDown(false)}
            style={[styles.learn, learnDown && styles.learnDown]}
            testID="word-pack-learn"
          >
            <MaterialIcon
              color={PACK_PALETTE.white}
              name="play_arrow"
              size={20}
            />
            <AppText numberOfLines={1} style={styles.learnText}>
              {learnTitle}
            </AppText>
          </Pressable>
          {onCheck ? (
            <Pressable
              accessibilityHint={t('wordPack.check_hint')}
              accessibilityLabel={t('wordPack.check')}
              accessibilityRole="button"
              onPress={onCheck}
              style={({pressed}) => [styles.check, pressed && styles.pressed]}
              testID="word-pack-check"
            >
              <AppText numberOfLines={1} style={styles.checkText}>
                {t('wordPack.check')}
              </AppText>
              <AppText numberOfLines={1} style={styles.checkHint}>
                {t('wordPack.check_hint')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ShelfSurface>
  );
}

/**
 * The gradient face and, on its right, the default vocab picture masked to
 * fade left and down.
 */
function HeroBackground({styles}: {styles: ReturnType<typeof makeStyles>}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id="packHeroFace" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={PACK_PALETTE.faceFrom} />
            <Stop offset="1" stopColor={PACK_PALETTE.faceTo} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#packHeroFace)" height="100%" width="100%" />
      </Svg>
      <Svg height={ART_HEIGHT} style={styles.art} width="100%">
        <Defs>
          <LinearGradient id="packHeroFadeX" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={PACK_PALETTE.white} stopOpacity={0} />
            <Stop
              offset="0.45"
              stopColor={PACK_PALETTE.white}
              stopOpacity={1}
            />
          </LinearGradient>
          <LinearGradient id="packHeroFadeY" x1="0" x2="0" y1="1" y2="0">
            <Stop offset="0" stopColor={PACK_PALETTE.white} stopOpacity={0} />
            <Stop
              offset="0.35"
              stopColor={PACK_PALETTE.white}
              stopOpacity={1}
            />
          </LinearGradient>
          <Mask id="packHeroMaskX">
            <Rect fill="url(#packHeroFadeX)" height="100%" width="100%" />
          </Mask>
          <Mask id="packHeroMaskY">
            <Rect fill="url(#packHeroFadeY)" height="100%" width="100%" />
          </Mask>
        </Defs>
        <G mask="url(#packHeroMaskX)">
          <G mask="url(#packHeroMaskY)">
            <SvgImage
              height="100%"
              href={DEFAULT_COVERS.vocab}
              preserveAspectRatio="xMidYMid slice"
              width="100%"
            />
          </G>
        </G>
      </Svg>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    face: {
      backgroundColor: PACK_PALETTE.faceFrom,
      overflow: 'hidden',
    },
    // The picture covers the right 62% of the card's top.
    art: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: '62%',
    },
    inner: {
      gap: 10,
      padding: 14,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      backgroundColor: PACK_PALETTE.chip,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    levelChip: {
      backgroundColor: PACK_PALETTE.sun,
    },
    chipText: {
      color: PACK_PALETTE.ink,
      fontSize: 12,
      fontWeight: '700',
    },
    kindText: {
      color: PACK_PALETTE.tealInk,
    },
    copy: {
      gap: 2,
      minHeight: 56,
      width: '62%',
    },
    title: {
      color: PACK_PALETTE.ink,
      fontSize: 26,
      fontWeight: '800',
      lineHeight: 31,
    },
    subtitle: {
      color: PACK_PALETTE.tealInk,
      fontSize: 13,
      fontWeight: '700',
    },
    // White strip with how far the learner is.
    strip: {
      backgroundColor: PACK_PALETTE.strip,
      borderRadius: 16,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    stripRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    stripLabel: {
      color: PACK_PALETTE.tealInk,
      fontSize: 13,
      fontWeight: '700',
    },
    count: {
      flexDirection: 'row',
    },
    countText: {
      color: PACK_PALETTE.ink,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    track: {
      backgroundColor: PACK_PALETTE.track,
      borderRadius: 5,
      height: 10,
      overflow: 'hidden',
    },
    fill: {
      backgroundColor: PACK_PALETTE.teal,
      borderRadius: 5,
      height: '100%',
    },
    ctas: {
      flexDirection: 'row',
      gap: 8,
    },
    learn: {
      alignItems: 'center',
      backgroundColor: PACK_PALETTE.coral,
      borderBottomColor: PACK_PALETTE.coralShelf,
      borderBottomWidth: 4,
      borderRadius: 18,
      flex: 1.35,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 12,
    },
    learnDown: {
      borderBottomWidth: 1,
      transform: [{translateY: 3}],
    },
    learnText: {
      color: PACK_PALETTE.white,
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '800',
    },
    check: {
      alignItems: 'center',
      backgroundColor: PACK_PALETTE.white,
      borderBottomColor: PACK_PALETTE.ghostShelf,
      borderBottomWidth: 4,
      borderRadius: 18,
      flex: 1,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 8,
    },
    checkText: {
      color: PACK_PALETTE.tealInk,
      fontSize: 14,
      fontWeight: '800',
    },
    checkHint: {
      color: PACK_PALETTE.tealInk,
      fontSize: 10.5,
      fontWeight: '600',
      opacity: 0.75,
    },
  });
}
