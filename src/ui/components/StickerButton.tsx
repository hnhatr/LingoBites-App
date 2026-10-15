import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {HERO_PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {withAlpha} from './layout';
import {MaterialIcon} from './MaterialIcon';

type Props = {
  label: string;
  onPress: () => void;
  /** `coral`: the main action of a screen; `ghost`: a lighter second one. */
  tone?: 'coral' | 'ghost';
  icon?: HandoffIconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * The full-width bottom button of the create screens (Chụp ảnh, Dán text,
 * Tình huống, YouTube): a coral face on a darker edge, like the lesson
 * player's "Tiếp tục". Disabled turns it flat grey so it never reads as
 * pressable.
 */
export function StickerButton({
  label,
  onPress,
  tone = 'coral',
  icon,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ink = disabled
    ? theme.colors.text.muted
    : tone === 'coral'
      ? HERO_PALETTE.white
      : theme.colors.primary;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        disabled
          ? styles.disabled
          : tone === 'coral'
            ? styles.coral
            : styles.ghost,
        pressed && !disabled
          ? tone === 'coral'
            ? styles.coralPressed
            : styles.ghostPressed
          : null,
      ]}
      testID={testID}
    >
      {icon ? <MaterialIcon color={ink} name={icon} size={20} /> : null}
      <AppText numberOfLines={1} style={[styles.label, {color: ink}]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      borderRadius: 20,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      minHeight: 56,
      paddingHorizontal: theme.spacing.lg,
    },
    coral: {
      backgroundColor: HERO_PALETTE.coral,
      ...getStickerEdge(4, HERO_PALETTE.coralShelf),
    },
    coralPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, HERO_PALETTE.coralShelf),
    },
    ghost: {
      backgroundColor: theme.colors.surface,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    ghostPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    disabled: {
      backgroundColor: theme.colors.surfaceHigh,
      ...getStickerEdge(4, withAlpha(theme.colors.outlineVariant, 0.5)),
    },
    label: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '800',
    },
  });
}
