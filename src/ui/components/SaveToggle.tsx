import React, {useMemo} from 'react';
import {
  type Insets,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import {
  ActionIconButton,
  type ActionIconSize,
} from '@ui/components/ActionIconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

const BACKDROP_SHADOW = '#000000';

export interface SaveToggleProps {
  saved: boolean;
  onPress: () => void;
  /**
   * A white rounded square behind the icon, for a button over a picture or
   * a many-coloured face where the bare icon would get lost.
   */
  backdrop?: boolean;
  /**
   * Draws it as the app's raised action button at this size (beige while
   * unsaved, mint once saved), for saves inside cards and list rows.
   * `size`, `iconSize` and `backdrop` are then ignored.
   */
  raised?: ActionIconSize;
  /** With `raised`: a white face, for a button on a beige card. */
  onTint?: boolean;
  /** Width and height of the button. */
  size?: number;
  iconSize?: number;
  /** Read aloud; defaults to saving or unsaving a lesson. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  hitSlop?: number | Insets;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The app's one save button: a grey "bookmark +" while unsaved and a filled
 * bookmark in the primary colour once saved.
 */
export function SaveToggle({
  saved,
  onPress,
  backdrop = false,
  raised,
  onTint = false,
  size = 36,
  iconSize = 20,
  accessibilityLabel,
  accessibilityHint,
  hitSlop,
  style,
  testID,
}: SaveToggleProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hint =
    accessibilityHint ??
    (saved ? 'Bỏ bài khỏi danh sách đã lưu' : 'Thêm bài vào danh sách đã lưu');
  const label = accessibilityLabel ?? (saved ? 'Bỏ lưu bài' : 'Lưu bài');
  const icon = saved ? 'bookmark' : 'bookmark_add';
  if (raised) {
    return (
      <ActionIconButton
        accessibilityHint={hint}
        accessibilityLabel={label}
        hitSlop={hitSlop}
        icon={icon}
        iconColor={saved ? undefined : theme.colors.text.muted}
        onPress={onPress}
        onTint={onTint}
        selected={saved}
        size={raised}
        style={style}
        testID={testID}
        tone={saved ? 'mint' : 'plain'}
      />
    );
  }
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{selected: saved}}
      hitSlop={hitSlop ?? 6}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        {height: size, width: size},
        backdrop ? styles.backdrop : null,
        style,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <MaterialIcon
        color={saved ? theme.colors.primary : theme.colors.text.muted}
        name={icon}
        size={iconSize}
      />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      borderRadius: 10,
      justifyContent: 'center',
    },
    backdrop: {
      backgroundColor: theme.colors.surface,
      elevation: 2,
      shadowColor: BACKDROP_SHADOW,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.18,
      shadowRadius: 3,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
  });
}
