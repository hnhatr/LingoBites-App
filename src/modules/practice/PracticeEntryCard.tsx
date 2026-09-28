import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {useAppTheme} from '@ui/theme/index';
import {summarizeSession} from './sessionEngine';
import type {UsePracticeController} from './usePracticeController';

type Props = {
  controller: UsePracticeController;
  isOffline: boolean;
  onOpenSession: (sessionId: string) => void;
  testID?: string;
};

export function PracticeEntryCard({
  controller,
  isOffline,
  onOpenSession,
  testID = 'practice-entry-card',
}: Props) {
  const {theme} = useAppTheme();
  const {
    projection,
    isPreparing,
    actionError,
    versionMismatchWarning,
    createPracticeSet,
    startNewSession,
    resumeExistingSession,
    restartAfterCompletion,
  } = controller;

  async function handleCreate() {
    await createPracticeSet();
  }

  async function handleRetryGeneration() {
    await createPracticeSet();
  }

  function handleRestart() {
    const session = restartAfterCompletion();
    if (session) {
      onOpenSession(session.id);
    }
  }

  function handleViewResult() {
    if (projection.session) {
      onOpenSession(projection.session.id);
    }
  }

  function handleContinue() {
    const existing = resumeExistingSession();
    if (existing) {
      onOpenSession(existing.id);
      return;
    }
    const session = startNewSession();
    if (session) {
      onOpenSession(session.id);
    }
  }

  function handleStartNewSession() {
    const session = startNewSession();
    if (session) {
      onOpenSession(session.id);
    }
  }

  const completedSummary =
    projection.state === 'completed' && projection.session
      ? summarizeSession({sessionId: projection.session.id})
      : null;

  return (
    <AppCard testID={testID}>
      <View style={styles.headerRow}>
        <AppText variant="h3">Luyện tập</AppText>
        {projection.state === 'ready' ? (
          <View
            style={[styles.badge, {backgroundColor: theme.colors.accentSoft}]}
          >
            <MaterialIcon
              color={theme.colors.accent}
              name="bookmark"
              size={16}
            />
            <AppText color="secondary" variant="caption">
              Đã tải
            </AppText>
          </View>
        ) : null}
      </View>

      {versionMismatchWarning ? (
        <AppText
          color="secondary"
          testID="practice-version-warning"
          variant="caption"
        >
          Bài học đã cập nhật; bạn đang tiếp tục trên bản cũ.
        </AppText>
      ) : null}

      {projection.state === 'not_created' ? (
        <View style={styles.body}>
          <AppText color="secondary">
            Tạo bài luyện tập nhanh từ nội dung bài học này.
          </AppText>
          {isOffline ? (
            <AppText color="secondary" testID="practice-offline-empty">
              Không có mạng. Kết nối lại để tạo bài luyện tập.
            </AppText>
          ) : null}
          <AppButton
            disabled={isOffline}
            loading={isPreparing}
            onPress={() => {
              handleCreate();
            }}
            testID="practice-create-button"
            title="Luyện tập nhanh"
          />
        </View>
      ) : null}

      {projection.state === 'generating' || isPreparing ? (
        <View
          accessibilityLabel="Đang tạo bài luyện tập"
          accessibilityRole="progressbar"
          style={styles.body}
          testID="practice-generating"
        >
          <ActivityIndicator color={theme.colors.primary} />
          <AppText color="secondary">Đang tạo bài luyện tập…</AppText>
          <AppText color="muted" variant="caption">
            Bạn có thể quay lại xem bài học bình thường.
          </AppText>
        </View>
      ) : null}

      {projection.state === 'generation_failed' ? (
        <View style={styles.body} testID="practice-generation-failed">
          <AppText color="danger">
            Không tạo được bài luyện tập. Bài học vẫn dùng bình thường.
          </AppText>
          <AppButton
            disabled={isOffline}
            loading={isPreparing}
            onPress={() => {
              handleRetryGeneration();
            }}
            testID="practice-retry-generation"
            title="Thử lại"
            variant="secondary"
          />
        </View>
      ) : null}

      {projection.state === 'ready' ? (
        <View style={styles.body} testID="practice-ready">
          <AppText color="secondary">
            Bài luyện tập đã sẵn sàng (
            {projection.practiceSet?.questions.length ?? 0} câu).
          </AppText>
          <AppButton
            onPress={handleContinue}
            testID="practice-start-button"
            title="Bắt đầu luyện tập"
          />
        </View>
      ) : null}

      {projection.state === 'in_progress' && projection.questionProgress ? (
        <View style={styles.body} testID="practice-in-progress">
          <AppText>
            Tiếp tục câu {projection.questionProgress.current}/
            {projection.questionProgress.total}
          </AppText>
          <AppButton
            onPress={handleContinue}
            testID="practice-continue-button"
            title="Tiếp tục luyện tập"
          />
        </View>
      ) : null}

      {projection.state === 'completed' && completedSummary ? (
        <View style={styles.body} testID="practice-completed">
          <AppText variant="h3">
            {completedSummary.correct}/{completedSummary.answered} đúng ·{' '}
            {completedSummary.score_percent}%
          </AppText>
          {completedSummary.review_candidates.length > 0 ? (
            <AppText color="secondary" variant="caption">
              {completedSummary.review_candidates.length} mục cần ôn lại
            </AppText>
          ) : null}
          <AppButton
            onPress={handleRestart}
            testID="practice-restart-button"
            title="Làm lại"
            variant="secondary"
          />
          <AppButton
            onPress={handleViewResult}
            testID="practice-review-button"
            title="Xem kết quả"
          />
        </View>
      ) : null}

      {projection.state === 'abandoned' ? (
        <View style={styles.body} testID="practice-abandoned">
          <AppText color="secondary">Phiên luyện tập trước đã dừng.</AppText>
          <AppButton
            onPress={handleStartNewSession}
            testID="practice-new-session-button"
            title="Bắt đầu phiên mới"
          />
        </View>
      ) : null}

      {actionError ? (
        <AppText color="danger" testID="practice-action-error">
          {actionError}
        </AppText>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  body: {
    gap: 12,
    marginTop: 8,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
