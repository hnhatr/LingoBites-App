import React from 'react';
import {Pressable, StyleSheet} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

/** Visual size of every screen-header button (back, close, toggles, CTA). */
export const HEADER_BUTTON_SIZE = 40;
/** Icon size inside a screen-header button. */
export const HEADER_ICON_SIZE = 22;
/** Extends the 40px visual to the 44px minimum touch target. */
export const HEADER_BUTTON_HIT_SLOP = 2;

type Props = {
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  /** Icon to render; ignored when `label` is set. */
  icon?: HandoffIconName;
  /** Short text shown instead of an icon (e.g. "IPA"). */
  label?: string;
  /** Toggle-on state: accent background instead of accentSoft. */
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
};

/**
 * The one button used inside `ScreenHeader`: a 40px accentSoft circle with a
 * 22px primary icon. Toggles switch to the accent fill while selected.
 */
export function HeaderIconButton({
  accessibilityLabel,
  accessibilityHint,
  onPress,
  icon,
  label,
  selected,
  disabled = false,
  testID,
}: Props) {
  const {theme} = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const foreground = selected ? theme.colors.accentInk : theme.colors.primary;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={
        selected === undefined ? {disabled} : {disabled, selected}
      }
      disabled={disabled}
      hitSlop={HEADER_BUTTON_HIT_SLOP}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        selected ? styles.selected : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
      testID={testID}
    >
      {label ? (
        <AppText style={{color: foreground}} variant="label">
          {label}
        </AppText>
      ) : icon ? (
        <MaterialIcon color={foreground} name={icon} size={HEADER_ICON_SIZE} />
      ) : null}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      height: HEADER_BUTTON_SIZE,
      justifyContent: 'center',
      width: HEADER_BUTTON_SIZE,
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    selected: {
      backgroundColor: theme.colors.accent,
    },
  });
}
