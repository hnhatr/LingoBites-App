import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';

import {
  HEADER_BUTTON_HIT_SLOP,
  HEADER_BUTTON_SIZE,
  HEADER_ICON_SIZE,
} from '@ui/components/HeaderIconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

type Props = {
  onPress: () => void;
};

/** Header action that starts a new lesson: a "+" next to a book. */
export function CreateLessonHeaderButton({onPress}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint="Mở màn hình tạo bài học"
      accessibilityLabel="Tạo bài học mới"
      accessibilityRole="button"
      hitSlop={HEADER_BUTTON_HIT_SLOP}
      onPress={onPress}
      style={styles.button}
      testID="library-create-lesson"
    >
      <MaterialIcon
        color={theme.colors.accentInk}
        name="add"
        size={HEADER_ICON_SIZE}
      />
      <MaterialIcon
        color={theme.colors.accentInk}
        name="menu_book"
        size={HEADER_ICON_SIZE}
      />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 2,
      height: HEADER_BUTTON_SIZE,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
  });
}
