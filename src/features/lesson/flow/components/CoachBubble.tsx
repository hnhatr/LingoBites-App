import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

/**
 * Redesign: the lesson mascot (a smiling tile) and a speech bubble with
 * what to do on this step.
 */
export function CoachBubble({text, testID}: {text: string; testID?: string}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.row} testID={testID}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={themedStyles.mascot}
      >
        <View style={themedStyles.eyes}>
          <View style={themedStyles.eye} />
          <View style={themedStyles.eye} />
        </View>
        <View style={themedStyles.smile} />
      </View>
      <View style={themedStyles.bubble}>
        <AppText variant="body">{text}</AppText>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    bubble: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 4,
      borderRadius: theme.radius.lg,
      flex: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      ...getStickerFace(theme, 0),
    },
    eye: {
      backgroundColor: colors.ink,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    eyes: {
      flexDirection: 'row',
      gap: 10,
    },
    mascot: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 18,
      gap: 4,
      height: 52,
      justifyContent: 'center',
      width: 52,
      ...getStickerFace(theme, 0),
    },
    row: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    smile: {
      borderBottomLeftRadius: 9,
      borderBottomRightRadius: 9,
      borderBottomWidth: 2.5,
      borderColor: colors.ink,
      borderLeftWidth: 2.5,
      borderRightWidth: 2.5,
      height: 9,
      width: 18,
    },
  });
}
