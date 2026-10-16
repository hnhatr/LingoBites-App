import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {answerWords} from '@core/learning';

import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {MaterialIcon} from './MaterialIcon';

type Props = {
  /** The word or phrase on the card: a phrase reads "Viết cụm từ". */
  text: string;
  onPress: () => void;
  testID?: string;
};

/** A word or phrase the tile keyboard can write: no pattern slots, not a long sentence. */
export function canWriteWord(text: string): boolean {
  const words = answerWords(text);
  return (
    !/[{}]/.test(text) &&
    words.length > 0 &&
    words.length <= 8 &&
    /\p{L}/u.test(text)
  );
}

/**
 * "Viết từ" / "Viết cụm từ" under a word card, in the app's sticker look:
 * a light blue face on a hard edge with a pencil tile, so it stands out on
 * the card without competing with the screen's main button.
 */
export function WriteWordButton({text, onPress, testID}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const phrase = answerWords(text).length > 1;
  const label = t(phrase ? 'writeWord.button_phrase' : 'writeWord.button');
  return (
    <Pressable
      accessibilityHint={t('writeWord.button_hint')}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.button, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.bubble}>
        <MaterialIcon color={theme.colors.text.inverse} name="edit" size={22} />
      </View>
      <Text maxFontSizeMultiplier={1.3} style={styles.label}>
        {label}
      </Text>
      <MaterialIcon
        color={theme.colors.primary}
        name="chevron_right"
        size={24}
      />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    bubble: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 40,
      justifyContent: 'center',
      width: 40,
      ...getStickerEdge(3, colors.primaryPressed),
    },
    button: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 20,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 56,
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.md,
      ...getStickerEdge(4, colors.outlineVariant),
    },
    label: {
      color: colors.primary,
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
    },
    pressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, colors.outlineVariant),
    },
  });
}
