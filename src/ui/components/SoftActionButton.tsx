import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {AppText} from './AppText';
import {withAlpha} from './layout';
import {MaterialIcon} from './MaterialIcon';

type Props = {
  label: string;
  icon: HandoffIconName;
  onPress: () => void;
  /** `mint` for the helpful action (Dán); `plain` for a quiet one (Xóa). */
  tone?: 'mint' | 'plain';
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/** A small inline button with a soft edge, e.g. "Dán" inside a text box. */
export function SoftActionButton({
  label,
  icon,
  onPress,
  tone = 'mint',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ink =
    tone === 'mint' ? theme.colors.primary : theme.colors.text.secondary;
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
        tone === 'mint' ? styles.mint : styles.plain,
        pressed && !disabled
          ? tone === 'mint'
            ? styles.mintPressed
            : styles.plainPressed
          : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      <MaterialIcon color={ink} name={icon} size={17} />
      <AppText style={[styles.label, {color: ink}]}>{label}</AppText>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primary, 0.22);
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 12,
    },
    mint: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(3, mintEdge),
    },
    mintPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, mintEdge),
    },
    plain: {
      backgroundColor: theme.colors.surfaceMuted,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    plainPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, theme.colors.surfaceHigh),
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
    label: {
      fontSize: 13.5,
      fontWeight: '700',
    },
  });
}
