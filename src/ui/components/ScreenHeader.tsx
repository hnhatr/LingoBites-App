import React from 'react';
import {StyleSheet, View} from 'react-native';

import {type AppTheme, useAppTheme} from '../theme';
import {AppText} from './AppText';
import {HeaderIconButton} from './HeaderIconButton';

type Props = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  /**
   * Buttons on the right, laid out in a row with a fixed gap. Use
   * `HeaderIconButton` (or a 40px-tall CTA) so every header matches.
   */
  rightAction?: React.ReactNode;
};

/**
 * Standard header for every screen except Home: 18px primary title on one
 * line, optional back button on the left, actions on the right.
 * Long titles (e.g. lesson names) belong in the page body, not here.
 */
export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Quay lại',
  rightAction,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={themedStyles.header} testID="screen-header">
      {onBack ? (
        <HeaderIconButton
          accessibilityLabel={backLabel}
          icon="arrow_back"
          onPress={onBack}
          testID="screen-header-back"
        />
      ) : null}
      <AppText
        color="primary"
        numberOfLines={1}
        style={styles.title}
        testID="screen-header-title"
        variant="h3"
      >
        {title}
      </AppText>
      {rightAction ? (
        <View style={themedStyles.actions}>{rightAction}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 56,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
  });
}
