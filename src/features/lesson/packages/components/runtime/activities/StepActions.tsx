import React from 'react';
import {Pressable, View} from 'react-native';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

type Props = {
  onComplete: () => void;
  onSkip?: () => void;
  completeLabel?: string;
  completeTestID?: string;
  skipTestID?: string;
};

/** Shared complete/skip action row used by every activity card. */
export function StepActions({
  onComplete,
  onSkip,
  completeLabel = 'Tiếp tục',
  completeTestID = 'lesson-step-complete',
  skipTestID = 'lesson-step-skip',
}: Props) {
  const {theme} = useAppTheme();
  return (
    <View style={{gap: theme.spacing.lg}}>
      <AppButton
        onPress={onComplete}
        testID={completeTestID}
        title={completeLabel}
      />
      {onSkip ? (
        <Pressable
          accessibilityLabel="Bỏ qua"
          accessibilityRole="button"
          onPress={onSkip}
          style={{alignSelf: 'center', paddingVertical: theme.spacing.xs}}
          testID={skipTestID}
        >
          <AppText color="secondary" variant="label">
            Bỏ qua
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
