/**
 * StudyFlashCard — one word while learning a pack or reviewing flashcards.
 *
 *   ┌──────────────────────────────┐
 *   │ [Daily life]                 │  mint-to-sky face
 *   │           August             │
 *   │       [/ˈɔːɡəst/  🔊]        │
 *   ├──────────────────────────────┤
 *   │ NGHĨA                        │
 *   │ tháng Tám                    │
 *   │ VÍ DỤ                        │
 *   │ [My birthday is in August.]  │  yellow panel
 *   └──────────────────────────────┘
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {type AppTheme, useAppTheme} from '../theme';
import {HERO_PALETTE as PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';
import {ShelfSurface} from './ShelfSurface';
import {formatIpa} from './WordCard';

type Props = {
  word: string;
  ipa: string | null;
  meaning: string;
  example: string | null;
  /** The pack's name, shown as a chip on the face; hidden when null. */
  packLabel: string | null;
  onSpeak: () => void;
  testID: string;
};

export function StudyFlashCard({
  word,
  ipa,
  meaning,
  example,
  packLabel,
  onSpeak,
  testID,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ShelfSurface
      borderRadius={28}
      containerTestID={testID}
      faceStyle={styles.card}
      shelfColor={theme.shelf?.surface.color ?? theme.colors.border}
      shelfHeight={6}
    >
      <View style={styles.face}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="packCardFace" x1="0" x2="1" y1="0" y2="1">
                <Stop offset="0" stopColor={PALETTE.faceFrom} />
                <Stop offset="1" stopColor={PALETTE.faceTo} />
              </LinearGradient>
            </Defs>
            <Rect fill="url(#packCardFace)" height="100%" width="100%" />
          </Svg>
        </View>
        {packLabel ? (
          <View style={styles.chip}>
            <AppText numberOfLines={1} style={styles.chipText}>
              {packLabel}
            </AppText>
          </View>
        ) : null}
        <AppText adjustsFontSizeToFit numberOfLines={2} style={styles.word}>
          {word}
        </AppText>
        <Pressable
          accessibilityHint={t('packQuiz.speak_hint')}
          accessibilityLabel={t('packQuiz.speak')}
          accessibilityRole="button"
          hitSlop={6}
          onPress={onSpeak}
          style={({pressed}) => [styles.ipaPill, pressed && styles.pressed]}
          testID={`${testID}-speak`}
        >
          {ipa ? (
            <AppText style={styles.ipaText}>{formatIpa(ipa)}</AppText>
          ) : null}
          <View style={styles.speak}>
            <MaterialIcon color={PALETTE.white} name="volume_up" size={16} />
          </View>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.block}>
          <AppText style={styles.label}>{t('packLearn.meaning')}</AppText>
          <AppText style={styles.meaning}>{meaning}</AppText>
        </View>
        {example ? (
          <View style={styles.block}>
            <AppText style={styles.label}>{t('packLearn.example')}</AppText>
            <View style={styles.example}>
              <AppText style={styles.exampleText}>{example}</AppText>
            </View>
          </View>
        ) : null}
      </View>
    </ShelfSurface>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    face: {
      alignItems: 'center',
      backgroundColor: PALETTE.faceFrom,
      gap: 10,
      paddingBottom: 20,
      paddingHorizontal: 18,
      paddingTop: 48,
    },
    chip: {
      backgroundColor: PALETTE.chip,
      borderRadius: theme.radius.pill,
      left: 12,
      maxWidth: '70%',
      paddingHorizontal: 10,
      paddingVertical: 4,
      position: 'absolute',
      top: 12,
    },
    chipText: {
      color: PALETTE.tealInk,
      fontSize: 12,
      fontWeight: '700',
    },
    word: {
      color: PALETTE.ink,
      fontSize: 42,
      fontWeight: '800',
      lineHeight: 48,
      textAlign: 'center',
    },
    ipaPill: {
      alignItems: 'center',
      backgroundColor: PALETTE.chip,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 8,
      minHeight: 40,
      paddingLeft: 12,
      paddingRight: 6,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    ipaText: {
      color: PALETTE.tealInk,
      fontSize: 15,
    },
    speak: {
      alignItems: 'center',
      backgroundColor: PALETTE.coral,
      borderRadius: 15,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    body: {
      gap: 14,
      padding: 18,
    },
    block: {
      gap: 6,
    },
    label: {
      color: theme.colors.text.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    meaning: {
      color: theme.colors.primary,
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 30,
    },
    example: {
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    exampleText: {
      color: theme.colors.text.primary,
      fontSize: 15,
      lineHeight: 21,
    },
  });
}
