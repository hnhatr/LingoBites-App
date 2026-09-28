import React, {useState} from 'react';
import {View} from 'react-native';
import {AppCard} from '@ui/components/AppCard';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme/index';
import type {GuidedPracticeStepData} from '../types';
import {StepActions} from './StepActions';

type Props = {
  data: GuidedPracticeStepData;
  onComplete: () => void;
  onSkip: () => void;
};

/** Guided practice: prompt then tap-to-reveal the answer. */
export function GuidedPracticeCard({data, onComplete, onSkip}: Props) {
  const {theme} = useAppTheme();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  return (
    <View style={{gap: theme.spacing.lg}}>
      {data.instructionsVi ? (
        <AppText color="secondary">{data.instructionsVi}</AppText>
      ) : null}
      {data.items.map(item => {
        const isRevealed = revealed.has(item.id);
        return (
          <AppCard key={item.id} style={{gap: theme.spacing.sm}}>
            <AppText variant="h3">{item.question}</AppText>
            {isRevealed ? (
              <AppText color="primary" testID={`guided-answer-${item.id}`}>
                {item.answer}
              </AppText>
            ) : (
              <AppButton
                onPress={() => setRevealed(prev => new Set(prev).add(item.id))}
                testID={`guided-reveal-${item.id}`}
                title="Xem đáp án"
                variant="secondary"
              />
            )}
          </AppCard>
        );
      })}
      <StepActions onComplete={onComplete} onSkip={onSkip} />
    </View>
  );
}
