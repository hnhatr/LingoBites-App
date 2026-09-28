import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme} from '@ui/theme/index';
import type {ShadowingStepData} from '../types';
import {StepActions} from './StepActions';

type Props = {
  data: ShadowingStepData;
  onPlayAudio: (assetId: string | null) => void;
  onComplete: () => void;
  onSkip: () => void;
};

/** Shadowing: play the audio, then the learner confirms they repeated it. */
export function ShadowingCard({data, onPlayAudio, onComplete, onSkip}: Props) {
  const {theme} = useAppTheme();
  const [repeated, setRepeated] = useState(false);

  return (
    <View style={{gap: theme.spacing.lg}}>
      {data.instructionsVi ? (
        <AppText color="secondary">{data.instructionsVi}</AppText>
      ) : null}
      {data.lines.map((line, index) => (
        <AppCard
          key={`${line.textEn}-${index}`}
          style={{gap: theme.spacing.sm}}
        >
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.spacing.sm,
            }}
            testID={`shadowing-line-row-${index}`}
          >
            <AppText
              style={styles.lineText}
              testID={`shadowing-line-en-${index}`}
              variant="h3"
            >
              {line.textEn}
            </AppText>
            <IconButton
              accessibilityLabel="Nghe phát âm"
              icon="volume_up"
              onPress={() => onPlayAudio(line.audioAssetId)}
              style={styles.audioButton}
              tone="ghost"
            />
          </View>
          <AppText color="primary">{line.textVi}</AppText>
        </AppCard>
      ))}
      <AppButton
        accessibilityState={{selected: repeated}}
        onPress={() => setRepeated(true)}
        testID="shadowing-confirm"
        title={repeated ? '✓ Tôi đã lặp lại' : 'Tôi đã lặp lại'}
        variant="secondary"
      />
      <StepActions onComplete={onComplete} onSkip={onSkip} />
    </View>
  );
}

const styles = StyleSheet.create({
  audioButton: {
    flexShrink: 0,
  },
  lineText: {
    flex: 1,
    flexShrink: 1,
  },
});
