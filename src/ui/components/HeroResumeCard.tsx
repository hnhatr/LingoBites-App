import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {type AppTheme, useAppTheme} from '../theme';
import {HERO_PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {HeroFill} from './HeroFill';
import {MaterialIcon} from './MaterialIcon';

type Props = {
  /** Small line in the white chip, e.g. "Đang dở · câu 5/12". */
  chip: string;
  title: string;
  subtitle?: string | null;
  /** The coral button's words, e.g. "Nói tiếp". */
  cta: string;
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
  chipTestID?: string;
};

/**
 * Something the learner left half done, on the mint-to-sky face of Home's
 * "Hôm nay" card: a chip, the title and a coral "carry on" button. The
 * whole card is one button.
 */
export function HeroResumeCard({
  chip,
  title,
  subtitle,
  cta,
  onPress,
  accessibilityHint,
  testID,
  chipTestID,
}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={[chip, title, subtitle, cta]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}
      testID={testID}
    >
      <HeroFill id={`${testID}-face`} />
      <View style={styles.chip}>
        <AppText style={styles.chipText} testID={chipTestID}>
          {chip}
        </AppText>
      </View>
      <AppText numberOfLines={2} style={styles.title}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      <View style={styles.cta}>
        <MaterialIcon color={HERO_PALETTE.white} name="play_circle" size={22} />
        <AppText style={styles.ctaText}>{cta}</AppText>
      </View>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: HERO_PALETTE.faceFrom,
      borderBottomColor: HERO_PALETTE.shelf,
      borderBottomWidth: 6,
      borderRadius: 26,
      gap: theme.spacing.sm,
      overflow: 'hidden',
      padding: theme.spacing.md,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    chip: {
      alignSelf: 'flex-start',
      backgroundColor: HERO_PALETTE.chip,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: {
      color: HERO_PALETTE.teal,
      fontSize: 12,
      fontWeight: '800',
    },
    title: {
      color: HERO_PALETTE.tealInk,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 25,
    },
    subtitle: {
      color: HERO_PALETTE.tealInk,
      fontSize: 14,
    },
    // The coral call to action of Home's card, with its shelf.
    cta: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.coral,
      borderBottomColor: HERO_PALETTE.coralShelf,
      borderBottomWidth: 4,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
      minHeight: 46,
    },
    ctaText: {
      color: HERO_PALETTE.white,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
