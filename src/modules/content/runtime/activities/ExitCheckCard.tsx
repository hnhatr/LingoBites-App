import React, {useMemo, useState} from 'react';
import {Pressable, View} from 'react-native';
import {AppCard} from '@ui/components/AppCard';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme/index';
import type {ExitCheckStepData} from '../types';

type Props = {
  data: ExitCheckStepData;
  onComplete: (answers: Array<{correct: boolean}>) => void;
  onSkip: () => void;
};

const SELF_GRADE_OPTIONS = [
  {key: 'remembered', label: 'Tôi nhớ', correct: true},
  {key: 'review', label: 'Cần ôn lại', correct: false},
] as const;

/** Exit check: a short 2-3 item assessment covering the lesson just seen. */
export function ExitCheckCard({data, onComplete, onSkip}: Props) {
  const {theme} = useAppTheme();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [selfGrades, setSelfGrades] = useState<Record<string, boolean>>({});
  const allItemsGraded = data.items.every(item => item.id in selfGrades);
  const answers = useMemo(
    () => data.items.map(item => ({correct: selfGrades[item.id] ?? false})),
    [data.items, selfGrades],
  );

  return (
    <View style={{gap: theme.spacing.lg}}>
      <AppText color="secondary" variant="label">
        Kiểm tra nhanh cuối bài
      </AppText>
      {data.items.length === 0 ? (
        <AppCard>
          <AppText color="secondary" testID="exit-check-empty">
            Chưa có câu hỏi cho bài kiểm tra này. Bạn vẫn có thể xem kết quả.
          </AppText>
        </AppCard>
      ) : null}
      {data.items.map(item => {
        const isRevealed = revealed.has(item.id);
        return (
          <AppCard key={item.id} style={{gap: theme.spacing.sm}}>
            <AppText variant="h3">{item.question}</AppText>
            {isRevealed ? (
              <>
                <View
                  style={{
                    backgroundColor: theme.colors.primaryContainer,
                    borderColor: theme.colors.outline,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <AppText
                    color="primary"
                    testID={`exit-check-answer-${item.id}`}
                    variant="bodyLg"
                  >
                    {item.answer}
                  </AppText>
                </View>
                <View style={{gap: theme.spacing.sm}}>
                  {SELF_GRADE_OPTIONS.map(option => (
                    <AppButton
                      key={option.key}
                      onPress={() =>
                        setSelfGrades(prev => ({
                          ...prev,
                          [item.id]: option.correct,
                        }))
                      }
                      testID={`exit-check-grade-${item.id}-${option.key}`}
                      title={option.label}
                      variant={
                        selfGrades[item.id] === option.correct
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
                testID={`exit-check-reveal-${item.id}`}
                title="Xem đáp án"
                variant="secondary"
              />
            )}
          </AppCard>
        );
      })}
      {!allItemsGraded && data.items.length > 0 ? (
        <AppText color="secondary" testID="exit-check-incomplete">
          Xem đáp án và tự đánh giá từng câu để hoàn thành.
        </AppText>
      ) : null}
      <View style={{gap: theme.spacing.lg}}>
        <AppButton
          disabled={!allItemsGraded && data.items.length > 0}
          onPress={() => onComplete(answers)}
          testID="exit-check-complete"
          title="Hoàn thành bài kiểm tra"
        />
        <Pressable
          accessibilityLabel="Bỏ qua"
          accessibilityRole="button"
          onPress={onSkip}
          style={{alignSelf: 'center', paddingVertical: theme.spacing.xs}}
          testID="exit-check-skip-link"
        >
          <AppText color="secondary" variant="label">
            Bỏ qua
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
