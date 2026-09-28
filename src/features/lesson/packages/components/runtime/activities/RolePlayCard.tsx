import React, {useState} from 'react';
import {View} from 'react-native';
import {AppCard} from '@ui/components/AppCard';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme} from '@ui/theme/index';
import type {RolePlayStepData} from '../../../logic/runtime/types';
import {StepActions} from './StepActions';

type Props = {
  data: RolePlayStepData;
  onPlayAudio: (assetId: string | null) => void;
  onComplete: () => void;
  onSkip: () => void;
};

/** Role-play: one dialogue turn at a time — play / record / confirm. */
export function RolePlayCard({data, onPlayAudio, onComplete, onSkip}: Props) {
  const {theme} = useAppTheme();
  const [confirmedIndex, setConfirmedIndex] = useState(0);

  return (
    <View style={{gap: theme.spacing.lg}}>
      {data.instructionsVi ? (
        <AppText color="secondary">{data.instructionsVi}</AppText>
      ) : null}
      {data.turns.map((turn, index) => (
        <AppCard key={turn.id} style={{gap: theme.spacing.sm}}>
          <AppText
            color="secondary"
            variant="label"
          >{`Người ${turn.speaker}`}</AppText>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="h3">{turn.text_en}</AppText>
            <IconButton
              accessibilityLabel="Nghe phát âm"
              icon="volume_up"
              onPress={() => onPlayAudio(turn.audio_ref_id ?? null)}
              tone="ghost"
            />
          </View>
          <AppText color="primary">{turn.text_vi}</AppText>
          {index <= confirmedIndex ? (
            <AppButton
              onPress={() =>
                setConfirmedIndex(prev => Math.max(prev, index + 1))
              }
              testID={`roleplay-confirm-${turn.id}`}
              title="Đã luyện tập lượt này"
              variant="secondary"
            />
          ) : null}
        </AppCard>
      ))}
      <StepActions onComplete={onComplete} onSkip={onSkip} />
    </View>
  );
}
