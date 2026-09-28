import React from 'react';
import {View} from 'react-native';
import {AppCard} from '@ui/components/AppCard';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme/index';
import type {FeedbackStepData} from '../types';

type Props = {
  data: FeedbackStepData;
  onFinish: () => void;
};

/** Feedback: lesson summary (new chunks, ratings, next-review hint). */
export function FeedbackCard({data, onFinish}: Props) {
  const {theme} = useAppTheme();
  return (
    <View style={{gap: theme.spacing.lg}}>
      <AppCard style={{gap: theme.spacing.md}}>
        <AppText variant="h2">Hoàn thành bài học!</AppText>
        <AppText testID="feedback-new-chunk-count">
          {`Cụm từ mới đã học: ${data.newChunkCount}`}
        </AppText>
        <AppText testID="feedback-completed-count">
          {`Đã hoàn thành: ${data.completedCount} hoạt động`}
        </AppText>
        <AppText testID="feedback-skipped-count">
          {`Đã bỏ qua: ${data.skippedCount} hoạt động`}
        </AppText>
        {data.checkTotalCount !== undefined ? (
          <View style={{gap: theme.spacing.xs}}>
            <AppText variant="h3">Kết quả kiểm tra</AppText>
            <AppText testID="feedback-check-score">
              {`${data.checkCorrectCount ?? 0}/${data.checkTotalCount} đúng · ${
                data.checkScorePercentage ?? 0
              }%`}
            </AppText>
            <AppText testID="feedback-check-outcome">
              {data.checkOutcome === 'pass'
                ? 'Đạt'
                : data.checkOutcome === 'conditional_pass'
                ? 'Đạt có điều kiện'
                : 'Chưa đạt'}
            </AppText>
            <AppText color="secondary" testID="feedback-check-feedback">
              {data.checkFeedbackVi}
            </AppText>
          </View>
        ) : null}
        <AppText color="secondary" testID="feedback-next-review-hint">
          {data.nextReviewHint}
        </AppText>
      </AppCard>
      <AppButton onPress={onFinish} title="Xong" />
    </View>
  );
}
