import React from 'react';
import {StyleSheet, View} from 'react-native';
import {AppText} from './AppText';
import {IconButton} from './IconButton';
import {useAppTheme, type AppTheme} from '../theme';

type Props = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: React.ReactNode;
  titleNumberOfLines?: number;
  numberOfLines?: number;
};

export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Quay lại',
  rightAction,
  titleNumberOfLines,
  numberOfLines,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const resolvedNumberOfLines = titleNumberOfLines ?? numberOfLines ?? 2;
  const isSingleLineTitle = resolvedNumberOfLines === 1;

  return (
    <View style={themedStyles.header} testID="screen-header">
      <View style={styles.titleRow}>
        {onBack ? (
          <IconButton
            accessibilityLabel={backLabel}
            icon="arrow_back"
            iconSize={24}
            onPress={onBack}
            tone="bare"
          />
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <AppText
          adjustsFontSizeToFit={!isSingleLineTitle}
          color="primary"
          minimumFontScale={isSingleLineTitle ? undefined : 0.85}
          numberOfLines={resolvedNumberOfLines}
          style={themedStyles.title}
          variant="h3"
        >
          {title}
        </AppText>
      </View>
      <View style={styles.rightAction}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backPlaceholder: {
    width: 44,
  },
  rightAction: {
    alignItems: 'flex-end',
    minWidth: 40,
  },
  titleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 56,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    title: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
  });
}
