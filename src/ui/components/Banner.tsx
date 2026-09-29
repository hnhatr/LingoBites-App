import React from 'react';
import {StyleSheet, View} from 'react-native';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';
import {useAppTheme} from '../theme';

type BannerVariant = 'info' | 'neutral';

type Props = {
  message: string;
  variant?: BannerVariant;
};

export function Banner({message, variant = 'info'}: Props) {
  const {theme} = useAppTheme();
  const isNeutral = variant === 'neutral';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isNeutral
            ? theme.colors.surfaceMuted
            : theme.colors.accentSoft,
          borderColor: isNeutral ? theme.colors.border : theme.colors.accent,
        },
      ]}
      testID="review-banner"
    >
      <MaterialIcon
        color={isNeutral ? theme.colors.text.secondary : theme.colors.primary}
        name="info"
        size={18}
      />
      <AppText color="secondary" variant="label" style={styles.message}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
