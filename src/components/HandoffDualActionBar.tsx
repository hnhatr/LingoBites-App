import React from 'react';
import {View} from 'react-native';
import {BottomActionBar} from './BottomActionBar';
import {AppButton} from './AppButton';
import {useAppTheme} from '../theme';

type Props = {
  backLabel?: string;
  continueLabel?: string;
  onBack: () => void;
  onContinue?: () => void;
  continueDisabled?: boolean;
};

export function HandoffDualActionBar({
  backLabel = 'Quay lại',
  continueLabel = 'Tiếp tục',
  onBack,
  onContinue,
  continueDisabled = false,
}: Props) {
  const {theme} = useAppTheme();

  return (
    <BottomActionBar
      style={{
        backgroundColor: theme.colors.background,
        borderTopColor: theme.colors.outlineVariant,
        paddingBottom: theme.spacing.lg,
      }}
    >
      <View style={{flexDirection: 'row', gap: theme.spacing.sm}}>
        <AppButton
          accessibilityHint="Quay lại bước trước"
          accessibilityLabel={backLabel}
          title={backLabel}
          variant="ghost"
          iconLeft="chevron_left"
          onPress={onBack}
          style={{flex: 1}}
        />
        {onContinue ? (
          <AppButton
            accessibilityHint="Tiếp tục bước tiếp theo"
            accessibilityLabel={continueLabel}
            title={continueLabel}
            variant="primary-accent"
            iconRight="chevron_right"
            disabled={continueDisabled}
            onPress={onContinue}
            style={{flex: 1.6}}
          />
        ) : null}
      </View>
    </BottomActionBar>
  );
}
