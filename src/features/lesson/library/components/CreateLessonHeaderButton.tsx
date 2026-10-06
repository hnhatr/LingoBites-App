import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';

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
      hitSlop={8}
      onPress={onPress}
      style={styles.button}
      testID="library-create-lesson"
    >
      <MaterialIcon color={theme.colors.accentInk} name="add" size={20} />
      <MaterialIcon color={theme.colors.accentInk} name="menu_book" size={20} />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: 20,
      flexDirection: 'row',
      gap: 2,
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
  });
}
