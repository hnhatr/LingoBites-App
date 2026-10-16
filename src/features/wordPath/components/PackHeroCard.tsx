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
import React, {useMemo} from 'react';
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
import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

export const PACK_PALETTE = HERO_PALETTE;

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
          <AppProgressBar compact done={learned} surface="hero" total={total} />
        </View>

        <View style={styles.ctas}>
          <Pressable
            accessibilityHint={t('wordPack.learn_hint')}
            accessibilityLabel={learnTitle}
            accessibilityRole="button"
            onPress={onLearn}
            style={({pressed}) => [styles.learn, pressed && styles.learnDown]}
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
              style={({pressed}) => [styles.check, pressed && styles.checkDown]}
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
    ctas: {
      flexDirection: 'row',
      gap: 8,
    },
    learn: {
      alignItems: 'center',
      backgroundColor: PACK_PALETTE.coral,
      borderRadius: 18,
      flex: 1.35,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 12,
      ...getStickerEdge(4, PACK_PALETTE.coralShelf),
    },
    learnDown: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, PACK_PALETTE.coralShelf),
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
      borderRadius: 18,
      flex: 1,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 8,
      ...getStickerEdge(4, PACK_PALETTE.ghostShelf),
    },
    checkDown: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, PACK_PALETTE.ghostShelf),
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
