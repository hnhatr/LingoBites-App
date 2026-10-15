import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

/**
 * A light listen button with a soft edge, quieter than the content.
 * `iconOnly` keeps the label for screen readers and shows just the icon.
 */
export function SoftButton({
  label,
  icon,
  onPress,
  accessibilityHint,
  iconOnly = false,
  testID,
}: {
  label: string;
  icon: HandoffIconName;
  onPress: () => void;
  accessibilityHint: string;
  iconOnly?: boolean;
  testID: string;
}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        themedStyles.soft,
        iconOnly ? themedStyles.iconOnly : null,
        pressed ? themedStyles.softPressed : null,
      ]}
      testID={testID}
    >
      <MaterialIcon
        color={theme.colors.primary}
        name={icon}
        size={iconOnly ? 20 : 17}
      />
      {iconOnly ? null : (
        <AppText style={themedStyles.softText}>{label}</AppText>
      )}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const edge = withAlpha(theme.colors.primary, 0.22);
  return StyleSheet.create({
    soft: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 13,
      ...getStickerEdge(3, edge),
    },
    iconOnly: {
      justifyContent: 'center',
      paddingHorizontal: 0,
      width: 44,
    },
    softPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, edge),
    },
    softText: {
      color: theme.colors.primary,
      fontSize: 13.5,
      fontWeight: '700',
    },
  });
}
