import type {
  LearnerStateSnapshot,
  ReasonCode,
  StudyActivityItem,
  StudyBlockPlan,
  TodayMode,
} from './types';

export const MODE_BUDGETS_MINUTES: Record<TodayMode, number> = {
  '5-minute': 5,
  normal: 20,
  'deep-practice': 45,
};

/**
 * User-facing Vietnamese labels for internal reason codes.
 * The raw enum (e.g. `SPEAKING_GAP_PRIORITY`) must never be rendered —
 * the plain-language `explanationVi` above the chips already explains why,
 * these short tags exist only for at-a-glance scanning.
 */
export const REASON_CODE_VI_LABELS: Record<ReasonCode, string> = {
  BACKLOG_CONSOLIDATION: 'Củng cố tồn đọng',
  REMEDIATE_RECENT_ERRORS: 'Chữa lỗi gần đây',
  LISTENING_REMEDIATION: 'Luyện nghe',
  ACTIVE_RECALL_WEAKNESS: 'Phản xạ chủ động',
  PREREQUISITE_NEEDED: 'Kiến thức nền',
  FAST_MASTERY_VARIATION: 'Biến thể thực hành',
  SPEAKING_GAP_PRIORITY: 'Ưu tiên phát âm',
  INTERVIEW_PORTFOLIO_PRIORITY: 'Luyện phỏng vấn',
  STANDARD_PROGRESSION: 'Lộ trình chuẩn',
};

function isSpeakingGap(snapshot: LearnerStateSnapshot, nowMs: number): boolean {
  if (
    !snapshot.speakingRecordings ||
    snapshot.speakingRecordings.length === 0
  ) {
    return true;
  }
  if (!snapshot.lastSpeakingAtIso) {
    return true;
  }
  const lastSpeakingMs = new Date(snapshot.lastSpeakingAtIso).getTime();
  if (isNaN(lastSpeakingMs)) {
    return true;
  }
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return nowMs - lastSpeakingMs > threeDaysMs;
}

function buildVietnameseExplanation(
  isConsolidation: boolean,
  reasonCodes: ReasonCode[],
): string {
  const parts: string[] = [];

  if (isConsolidation) {
    parts.push(
      'Lượng bài cần ôn tập đang cao (hoặc thời gian ôn > 10 phút), chuyển sang khối củng cố và tạm dừng bài học mới.',
    );
  }

  for (const code of reasonCodes) {
    switch (code) {
      case 'REMEDIATE_RECENT_ERRORS':
        parts.push('Ưu tiên khắc phục các lỗi sai vừa ghi nhận.');
        break;
      case 'LISTENING_REMEDIATION':
        parts.push(
          'Tăng cường luyện nghe không kịch bản cho các phần nghe chưa vững.',
        );
        break;
      case 'ACTIVE_RECALL_WEAKNESS':
        parts.push(
          'Tăng cường ôn tập phản xạ chủ động cho nội dung nhận diện yếu.',
        );
        break;
      case 'PREREQUISITE_NEEDED':
        parts.push('Củng cố bài học vi mô tiền đề trước khi sang bài mới.');
        break;
      case 'FAST_MASTERY_VARIATION':
        parts.push('Tăng biến thể thực hành cho các kiến thức đã nhớ nhanh.');
        break;
      case 'SPEAKING_GAP_PRIORITY':
        parts.push(
          'Đã lâu bạn chưa luyện phát âm, ưu tiên thực hành trong Phòng Luyện Nói.',
        );
        break;
      case 'INTERVIEW_PORTFOLIO_PRIORITY':
        parts.push('Tập trung luyện phỏng vấn theo mục tiêu hồ sơ cá nhân.');
        break;
      case 'STANDARD_PROGRESSION':
        if (!isConsolidation) {
          parts.push(
            'Kế hoạch hôm nay kết hợp ôn tập định kỳ, bài học mới và luyện tập tình huống.',
          );
        }
        break;
      default:
        break;
    }
  }

  return parts.length > 0
    ? parts.join(' ')
    : 'Kế hoạch học tập tối ưu dựa trên trạng thái hiện tại của bạn.';
}

export function generateStudyBlock(
  snapshot: LearnerStateSnapshot,
  mode: TodayMode = 'normal',
  nowIso?: string,
): StudyBlockPlan {
  const nowMs = nowIso ? new Date(nowIso).getTime() : Date.now();
  const maxBudgetMinutes = MODE_BUDGETS_MINUTES[mode] ?? 20;

  // REQ-14: due_count > 20 OR estimated_review_minutes > 10
  const isConsolidation =
    snapshot.dueReviewCount > 20 || snapshot.estimatedReviewMinutes > 10;

  const reasonCodes: ReasonCode[] = [];
  const candidateActivities: StudyActivityItem[] = [];

  if (isConsolidation) {
    reasonCodes.push('BACKLOG_CONSOLIDATION');
  }

  // 1. Backlog / Due Review Activity
  if (snapshot.dueReviewCount > 0 || isConsolidation) {
    const reviewEstMins = Math.min(
      mode === '5-minute' ? 5 : 10,
      Math.max(3, snapshot.estimatedReviewMinutes),
    );
    candidateActivities.push({
      id: 'activity-due-review',
      type: 'due_review',
      titleVi: isConsolidation
        ? 'Củng cố ôn tập tồn đọng'
        : 'Ôn tập thẻ ghi nhớ đến hạn',
      subtitleVi: `${snapshot.dueReviewCount} mục đến hạn ôn tập`,
      estimatedMinutes: reviewEstMins,
      targetId: 'due_review',
      navigationTarget: {screen: 'DailyReview'},
    });
  }

  // 2. Recent Errors / Remediation (REQ-30, REQ-33)
  if (snapshot.recentErrors && snapshot.recentErrors.length > 0) {
    reasonCodes.push('REMEDIATE_RECENT_ERRORS');
    candidateActivities.push({
      id: 'activity-error-remediation',
      type: 'error_remediation',
      titleVi: 'Khắc phục lỗi sai gần đây',
      subtitleVi: `${snapshot.recentErrors.length} lỗi sai phát âm / từ vựng cần ôn lại`,
      estimatedMinutes: 3,
      targetId: 'error_remediation',
      navigationTarget: {screen: 'DailyReview'},
    });
  }

  // 3. Listening Remediation (REQ-33)
  const hasListeningError = snapshot.recentErrors?.some(
    e => e.category === 'listening',
  );
  if (hasListeningError) {
    reasonCodes.push('LISTENING_REMEDIATION');
    candidateActivities.push({
      id: 'activity-listening-remediation',
      type: 'listening_remediation',
      titleVi: 'Luyện nghe không kịch bản',
      subtitleVi: 'Rèn luyện phản xạ nghe thấu không nhìn văn bản',
      estimatedMinutes: 5,
      targetId: 'listening_remediation',
      navigationTarget: {screen: 'DailyReview'},
    });
  }

  // 4. Active Recall for Recognition Weakness (REQ-33)
  if (
    snapshot.recognitionOnlyItemIds &&
    snapshot.recognitionOnlyItemIds.length > 0
  ) {
    reasonCodes.push('ACTIVE_RECALL_WEAKNESS');
    candidateActivities.push({
      id: 'activity-active-recall',
      type: 'active_recall',
      titleVi: 'Ôn tập phản xạ chủ động',
      subtitleVi: 'Chuyển đổi từ nhận diện thụ động sang sản xuất câu chủ động',
      estimatedMinutes: 3,
      targetId: 'active_recall',
      navigationTarget: {screen: 'DailyReview'},
    });
  }

  // 5. Prerequisite Micro-Lesson (REQ-33)
  if (snapshot.lessonProgression?.prerequisiteGapLessonId) {
    reasonCodes.push('PREREQUISITE_NEEDED');
    candidateActivities.push({
      id: 'activity-prerequisite-lesson',
      type: 'prerequisite_lesson',
      titleVi: `Bài học vi mô tiền đề: ${
        snapshot.lessonProgression.prerequisiteGapTitle ?? 'Kiến thức nền'
      }`,
      subtitleVi: 'Hoàn thành tiền đề trước khi sang bài học tiếp theo',
      estimatedMinutes: 5,
      targetId: snapshot.lessonProgression.prerequisiteGapLessonId,
      navigationTarget: {
        screen: 'ContentLessonRuntime',
        params: {lessonId: snapshot.lessonProgression.prerequisiteGapLessonId},
      },
    });
  }

  // 6. Fast Mastery Variation (REQ-33)
  if (snapshot.fastMasteryItemIds && snapshot.fastMasteryItemIds.length > 0) {
    reasonCodes.push('FAST_MASTERY_VARIATION');
    candidateActivities.push({
      id: 'activity-fast-mastery-variation',
      type: 'old_situation_practice',
      titleVi: 'Luyện tập biến thể tình huống',
      subtitleVi: 'Tăng cường biến thể bài tập cho các từ vựng đã nhớ nhanh',
      estimatedMinutes: 5,
      targetId: snapshot.lessonProgression?.oldLessonId ?? 'fast_mastery',
      navigationTarget: snapshot.lessonProgression?.oldLessonId
        ? {
            screen: 'ContentLessonRuntime',
            params: {lessonId: snapshot.lessonProgression.oldLessonId},
          }
        : {screen: 'DailyReview'},
    });
  }

  // 7. Speaking Gap Prioritization (REQ-33)
  if (isSpeakingGap(snapshot, nowMs)) {
    reasonCodes.push('SPEAKING_GAP_PRIORITY');
    candidateActivities.push({
      id: 'activity-speaking-gap',
      type: 'speaking_practice',
      titleVi: 'Luyện phát âm trong Phòng Luyện Nói',
      subtitleVi: 'Thực hành nhại giọng (shadowing) và tự kiểm tra phát âm',
      estimatedMinutes: 5,
      targetId: 'speaking_room',
      navigationTarget: {screen: 'SpeakingRoom'},
    });
  }

  // 8. Interview Portfolio Prioritization (REQ-33)
  // Safely degrades if profileData is null/undefined
  if (snapshot.profileData?.hasInterviewTarget) {
    reasonCodes.push('INTERVIEW_PORTFOLIO_PRIORITY');
    candidateActivities.push({
      id: 'activity-interview-portfolio',
      type: 'interview_practice',
      titleVi: 'Luyện tập phỏng vấn theo hồ sơ',
      subtitleVi: 'Trả lời các câu hỏi phỏng vấn dựa trên mục tiêu nghề nghiệp',
      estimatedMinutes: 10,
      targetId: 'interview_practice',
      navigationTarget: {screen: 'SpeakingRoom'},
    });
  }

  // 9. Next Lesson Progression (REQ-12) - STOPPED/REDUCED IF CONSOLIDATION
  if (!isConsolidation && snapshot.lessonProgression?.nextLessonId) {
    const nextLessonMins =
      snapshot.lessonProgression.nextLessonEstimatedMinutes ?? 15;
    candidateActivities.push({
      id: 'activity-next-lesson',
      type: 'next_lesson',
      titleVi: `Bài học mới: ${
        snapshot.lessonProgression.nextLessonTitle ?? 'Bài tiếp theo'
      }`,
      subtitleVi: 'Tiếp tục lộ trình bài học chính',
      estimatedMinutes: nextLessonMins,
      targetId: snapshot.lessonProgression.nextLessonId,
      navigationTarget: {
        screen: 'ContentLessonRuntime',
        params: {lessonId: snapshot.lessonProgression.nextLessonId},
      },
    });
  }

  // 10. Old Situation Practice (REQ-12) if not consolidation and budget allows
  if (
    !isConsolidation &&
    snapshot.lessonProgression?.oldLessonId &&
    !candidateActivities.some(a => a.type === 'old_situation_practice')
  ) {
    candidateActivities.push({
      id: 'activity-old-situation',
      type: 'old_situation_practice',
      titleVi: `Ôn lại tình huống: ${
        snapshot.lessonProgression.oldLessonTitle ?? 'Tình huống đã học'
      }`,
      subtitleVi: 'Củng cố khả năng phản xạ trong tình huống thực tế',
      estimatedMinutes: 5,
      targetId: snapshot.lessonProgression.oldLessonId,
      navigationTarget: {
        screen: 'ContentLessonRuntime',
        params: {lessonId: snapshot.lessonProgression.oldLessonId},
      },
    });
  }

  // If no specific rule triggered, add STANDARD_PROGRESSION tag
  if (
    !isConsolidation &&
    !reasonCodes.some(
      r =>
        r === 'REMEDIATE_RECENT_ERRORS' ||
        r === 'LISTENING_REMEDIATION' ||
        r === 'ACTIVE_RECALL_WEAKNESS' ||
        r === 'PREREQUISITE_NEEDED' ||
        r === 'FAST_MASTERY_VARIATION' ||
        r === 'SPEAKING_GAP_PRIORITY' ||
        r === 'INTERVIEW_PORTFOLIO_PRIORITY',
    )
  ) {
    reasonCodes.push('STANDARD_PROGRESSION');
  }

  // Select activities fitting within target mode budget
  const selectedActivities: StudyActivityItem[] = [];
  let currentMinutes = 0;

  for (const act of candidateActivities) {
    if (selectedActivities.length === 0) {
      selectedActivities.push(act);
      currentMinutes += act.estimatedMinutes;
      continue;
    }

    if (currentMinutes + act.estimatedMinutes <= maxBudgetMinutes + 2) {
      selectedActivities.push(act);
      currentMinutes += act.estimatedMinutes;
    }
  }

  // Fallback: If candidateActivities was empty (e.g. clean slate with no data)
  if (selectedActivities.length === 0) {
    selectedActivities.push({
      id: 'activity-fallback',
      type: 'due_review',
      titleVi: 'Khởi động bài học',
      subtitleVi: 'Bắt đầu với bài học hoặc ôn tập hàng ngày',
      estimatedMinutes: 5,
      navigationTarget: {screen: 'DailyReview'},
    });
    currentMinutes = 5;
  }

  const explanationVi = buildVietnameseExplanation(
    isConsolidation,
    reasonCodes,
  );

  return {
    mode,
    isConsolidation,
    totalEstimatedMinutes: currentMinutes,
    reasonCodes,
    explanationVi,
    activities: selectedActivities,
  };
}
