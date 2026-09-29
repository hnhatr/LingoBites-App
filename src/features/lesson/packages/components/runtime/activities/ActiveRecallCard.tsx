import React, {useState} from 'react';
import {View} from 'react-native';
import {AppCard} from '@ui/components/AppCard';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme/index';
import type {ActiveRecallStepData} from '../../../logic/runtime/types';
import {StepActions} from './StepActions';

type Props = {
  data: ActiveRecallStepData;
  onComplete: () => void;
  onSkip: () => void;
};

const SELF_RATE_OPTIONS = [
  {key: 'again', label: 'Chưa nhớ'},
  {key: 'good', label: 'Nhớ tốt'},
] as const;

/** Active recall: prompt -> reveal answer -> self-rate confidence. */
export function ActiveRecallCard({data, onComplete, onSkip}: Props) {
  const {theme} = useAppTheme();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, string>>({});

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
              <>
                <AppText color="primary" testID={`recall-answer-${item.id}`}>
                  {item.answer}
                </AppText>
                <View style={{flexDirection: 'row', gap: theme.spacing.sm}}>
                  {SELF_RATE_OPTIONS.map(option => (
                    <AppButton
                      key={option.key}
                      onPress={() =>
                        setRatings(prev => ({...prev, [item.id]: option.key}))
                      }
                      testID={`recall-rate-${item.id}-${option.key}`}
                      title={option.label}
                      variant={
                        ratings[item.id] === option.key
                          ? 'primary'
                          : 'secondary'
                      }
                    />
                  ))}
                </View>
              </>
            ) : (
              <AppButton
                onPress={() => setRevealed(prev => new Set(prev).add(item.id))}
                testID={`recall-reveal-${item.id}`}
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
