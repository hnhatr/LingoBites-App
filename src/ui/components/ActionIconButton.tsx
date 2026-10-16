import React, {useMemo} from 'react';
import {
  type Insets,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {HERO_PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {withAlpha} from './layout';
import {MaterialIcon} from './MaterialIcon';

/**
 * What the button does sets its colour: `plain` (beige) for everyday actions
 * such as listen, close or play a recording; `mint` for AI actions and for a
 * saved / switched-on state; `alert` (beige with a coral icon) for report and
 * delete.
 */
export type ActionIconTone = 'plain' | 'mint' | 'alert';

/**
 * Where the button sits: `compact` inside a bubble or a text line, `row` in a
 * card or list row, `bar` in the bottom playback bar, `large` as the one
 * action in the middle of a card.
 */
export type ActionIconSize = 'compact' | 'row' | 'bar' | 'large';

const SIZES: Record<
  ActionIconSize,
  {box: number; radius: number; icon: number; edge: number; hitSlop: number}
> = {
  compact: {box: 32, radius: 10, icon: 16, edge: 2, hitSlop: 6},
  row: {box: 40, radius: 12, icon: 19, edge: 3, hitSlop: 2},
  bar: {box: 46, radius: 16, icon: 22, edge: 3, hitSlop: 0},
  large: {box: 64, radius: 20, icon: 28, edge: 4, hitSlop: 0},
};

export type ActionIconButtonProps = {
  icon: HandoffIconName;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  tone?: ActionIconTone;
  size?: ActionIconSize;
  /** Short text after the icon, e.g. "Xem phân tích"; the button widens. */
  label?: string;
  /** White face on a near-white edge, for a button on a beige or bright card. */
  onTint?: boolean;
  /** Overrides the tone's icon colour, e.g. grey for "not saved yet". */
  iconColor?: string;
  selected?: boolean;
  disabled?: boolean;
  hitSlop?: number | Insets;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The app's one icon button for actions inside screens: a rounded square on
 * a soft raised edge that sinks when pressed. Header buttons use
 * `HeaderIconButton`; a screen's single hero action (YouTube play, the record
 * button) keeps its own look.
 */
export function ActionIconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  tone = 'plain',
  size = 'row',
  label,
  onTint = false,
  iconColor,
  selected,
  disabled = false,
  hitSlop,
  style,
  testID,
}: ActionIconButtonProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const metrics = SIZES[size];
  const face = faceFor(theme, tone, onTint);
  const ink = tone === 'alert' ? HERO_PALETTE.coralShelf : theme.colors.primary;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={
        selected === undefined ? {disabled} : {disabled, selected}
      }
      disabled={disabled}
      hitSlop={hitSlop ?? metrics.hitSlop}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        {
          backgroundColor: face.background,
          borderRadius: metrics.radius,
          height: metrics.box,
          minWidth: metrics.box,
        },
        label ? styles.withLabel : {width: metrics.box},
        pressed && !disabled
          ? [
              styles.pressed,
              getStickerEdge(Math.max(1, metrics.edge - 2), face.edge),
            ]
          : getStickerEdge(metrics.edge, face.edge),
        disabled ? styles.disabled : null,
        style,
      ]}
      testID={testID}
    >
      <MaterialIcon color={iconColor ?? ink} name={icon} size={metrics.icon} />
      {label ? (
        <AppText style={[styles.label, {color: ink}]} variant="label">
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function faceFor(
  theme: AppTheme,
  tone: ActionIconTone,
  onTint: boolean,
): {background: string; edge: string} {
  if (tone === 'mint') {
    return {
      background: theme.colors.accentSoft,
      edge: withAlpha(theme.colors.primary, 0.22),
    };
  }
  if (onTint) {
    return {background: theme.colors.surface, edge: HERO_PALETTE.ghostShelf};
  }
  return {
    background: theme.colors.surfaceMuted,
    edge: theme.colors.surfaceHigh,
  };
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    withLabel: {
      gap: 6,
      paddingHorizontal: 12,
    },
    label: {
      fontWeight: '800',
    },
    pressed: {
      transform: [{translateY: 2}],
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
  });
}
