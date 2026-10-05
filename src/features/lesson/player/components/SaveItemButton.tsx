import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type SaveItemButtonProps = {
  saved: boolean;
  /** Label while unsaved ("Lưu thẻ" / "Đánh dấu"). */
  label: string;
  /** Label once saved ("Đã lưu"). */
  savedLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  testID?: string;
};

/** Compact pill that saves a lesson item and shows "Đã lưu" once saved. */
export function SaveItemButton({
  saved,
  label,
  savedLabel,
  accessibilityHint,
  onPress,
  testID,
}: SaveItemButtonProps) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const text = saved ? savedLabel : label;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={text}
      accessibilityRole="button"
      accessibilityState={{selected: saved}}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        themedStyles.pill,
        saved ? themedStyles.pillSaved : null,
        pressed ? {opacity: theme.states.pressedOpacity} : null,
      ]}
    >
      <MaterialIcon
        color={theme.colors.primary}
        name={saved ? 'bookmark' : 'bookmark_add'}
        size={18}
      />
      <AppText style={themedStyles.label} variant="label">
        {text}
      </AppText>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    label: {
      color: theme.colors.primary,
    },
    pill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
    },
    pillSaved: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.accentSoft,
    },
  });
}
