import React from 'react';
import {Pressable, StyleSheet} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {HERO_PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {withAlpha} from './layout';
import {MaterialIcon} from './MaterialIcon';

/** Visual size of every screen-header button (back, close, toggles, CTA). */
export const HEADER_BUTTON_SIZE = 42;
/** Icon size inside a screen-header button. */
export const HEADER_ICON_SIZE = 22;
/** Extends the 42px visual past the 44px minimum touch target. */
export const HEADER_BUTTON_HIT_SLOP = 2;
/** Corner radius of a screen-header button: a rounded square. */
export const HEADER_BUTTON_RADIUS = 14;

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
 * The one button used inside `ScreenHeader`: a 42px accentSoft rounded square
 * on a mint raised edge, with a 22px primary icon. Toggles switch to the
 * accent fill on a teal edge while selected. Pressing sinks it into its edge.
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
        pressed && !disabled
          ? selected
            ? styles.selectedPressed
            : styles.pressed
          : null,
        disabled ? styles.disabled : null,
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
  const mintEdge = withAlpha(theme.colors.primary, 0.3);
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: HEADER_BUTTON_RADIUS,
      height: HEADER_BUTTON_SIZE,
      justifyContent: 'center',
      width: HEADER_BUTTON_SIZE,
      ...getStickerEdge(3, mintEdge),
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
    pressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, mintEdge),
    },
    selected: {
      backgroundColor: theme.colors.accent,
      ...getStickerEdge(3, HERO_PALETTE.shelf),
    },
    selectedPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, HERO_PALETTE.shelf),
    },
  });
}
