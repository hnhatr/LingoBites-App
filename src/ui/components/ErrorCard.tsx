import React from 'react';
import {View} from 'react-native';
import {AppButton} from './AppButton';
import {AppText} from './AppText';
import {useAppTheme} from '../theme';

type Props = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorCard({message, onRetry, retryLabel = 'Thử lại'}: Props) {
  const {theme} = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.secondaryContainer,
        borderRadius: theme.radius.lg,
        gap: theme.spacing.sm,
        padding: theme.spacing.lg,
      }}
    >
      <AppText color="danger">{message}</AppText>
      {onRetry ? (
        <AppButton title={retryLabel} variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}
