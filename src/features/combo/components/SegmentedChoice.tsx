import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

type Option = {key: string; label: string; testID?: string};

type Props = {
  options: Option[];
  selected: string | null;
  onSelect: (key: string) => void;
  accessibilityHint: string;
};

/** Vocab path P5: a one-line single choice for the combo set-up. */
export function SegmentedChoice({
  options,
  selected,
  onSelect,
  accessibilityHint,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View accessibilityRole="radiogroup" style={themedStyles.track}>
      {options.map(option => {
        const on = option.key === selected;
        return (
          <Pressable
            accessibilityHint={accessibilityHint}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{selected: on}}
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[styles.segment, on && themedStyles.segmentOn]}
            testID={option.testID}
          >
            <AppText
              numberOfLines={1}
              style={on ? themedStyles.labelOn : themedStyles.label}
              variant="label"
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 4,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    label: {
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.weight.medium,
    },
    labelOn: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.bold,
    },
    segmentOn: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      padding: theme.spacing.xs,
    },
  });
}
