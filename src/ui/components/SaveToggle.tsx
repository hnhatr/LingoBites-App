import React, {useMemo} from 'react';
import {
  type Insets,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

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
  size = 36,
  iconSize = 20,
  accessibilityLabel,
  accessibilityHint,
  hitSlop = 6,
  style,
  testID,
}: SaveToggleProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint={
        accessibilityHint ??
        (saved
          ? 'Bỏ bài khỏi danh sách đã lưu'
          : 'Thêm bài vào danh sách đã lưu')
      }
      accessibilityLabel={
        accessibilityLabel ?? (saved ? 'Bỏ lưu bài' : 'Lưu bài')
      }
      accessibilityRole="button"
      accessibilityState={{selected: saved}}
      hitSlop={hitSlop}
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
        name={saved ? 'bookmark' : 'bookmark_add'}
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
