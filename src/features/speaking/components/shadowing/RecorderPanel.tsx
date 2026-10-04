import React from 'react';
import {View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme} from '@ui/theme';

import {
  formatShadowingElapsed,
  SHADOWING_MAX_RECORDING_MS,
  type ShadowingSessionState,
} from '../../logic/shadowing/useShadowingSession';

export type RecorderPanelProps = {
  sessionState: ShadowingSessionState;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
};

export function RecorderPanel({
  sessionState,
  elapsedMs,
  onStart,
  onStop,
}: RecorderPanelProps) {
  const {theme} = useAppTheme();
  const recording = sessionState === 'recording';
  const maxLabel = formatShadowingElapsed(SHADOWING_MAX_RECORDING_MS);

  return (
    <AppCard
      style={{alignItems: 'center', gap: theme.spacing.sm}}
      testID="shadowing-recorder-panel"
    >
      <IconButton
        accessibilityLabel={recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
        icon={recording ? 'circle' : 'mic'}
        onPress={recording ? onStop : onStart}
        size={64}
        testID="shadowing-record-button"
        tone={recording ? 'danger' : 'accent'}
      />
      {recording ? (
        <AppText testID="shadowing-recording-counter">
          {formatShadowingElapsed(elapsedMs)} / {maxLabel}
        </AppText>
      ) : (
        <AppText color="secondary" testID="shadowing-record-hint">
          Bấm để ghi âm · tối đa 30 giây
        </AppText>
      )}
      {recording ? (
        <View
          accessibilityLabel="Mức âm thanh"
          style={{
            backgroundColor: theme.colors.accentSoft,
            borderRadius: theme.radius.sm,
            height: 8,
            width: '80%',
          }}
          testID="shadowing-level-animation"
        />
      ) : null}
    </AppCard>
  );
}
