import React from 'react';
import {StyleSheet} from 'react-native';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {useAppTheme} from '@ui/theme';

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

/**
 * Save button with its label, in the colours of the shared save toggle:
 * beige with a grey "bookmark +" while unsaved, mint with a filled bookmark
 * and "Đã lưu" once saved.
 */
export function SaveItemButton({
  saved,
  label,
  savedLabel,
  accessibilityHint,
  onPress,
  testID,
}: SaveItemButtonProps) {
  const {theme} = useAppTheme();
  const text = saved ? savedLabel : label;
  return (
    <ActionIconButton
      accessibilityHint={accessibilityHint}
      accessibilityLabel={text}
      icon={saved ? 'bookmark' : 'bookmark_add'}
      iconColor={saved ? undefined : theme.colors.text.muted}
      label={text}
      onPress={onPress}
      selected={saved}
      style={styles.button}
      testID={testID}
      tone={saved ? 'mint' : 'plain'}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
  },
});
