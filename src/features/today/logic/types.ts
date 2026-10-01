import type {ErrorEventRecord, SpeakingRecordingRecord} from '@core/db/types';

export type TodayMode = '5-minute' | 'normal' | 'deep-practice';

export type ReasonCode =
  | 'BACKLOG_CONSOLIDATION'
  | 'REMEDIATE_RECENT_ERRORS'
  | 'LISTENING_REMEDIATION'
  | 'ACTIVE_RECALL_WEAKNESS'
  | 'PREREQUISITE_NEEDED'
  | 'FAST_MASTERY_VARIATION'
  | 'SPEAKING_GAP_PRIORITY'
  | 'INTERVIEW_PORTFOLIO_PRIORITY'
  | 'STANDARD_PROGRESSION';

export type StudyActivityType =
  | 'due_review'
  | 'error_remediation'
  | 'listening_remediation'
  | 'active_recall'
  | 'prerequisite_lesson'
  | 'next_lesson'
  | 'old_situation_practice'
  | 'speaking_practice'
  | 'interview_practice';

export type TodayNavigationTarget = {
  screen:
    | 'DailyReview'
    | 'CanonicalLessonPlayer'
    | 'CanonicalCatalog'
    | 'SpeakingRoom'
    | 'SpeakingShadowing'
    | 'FlashcardList';
  params?: Record<string, unknown>;
};

export type StudyActivityItem = {
  id: string;
  type: StudyActivityType;
  titleVi: string;
  subtitleVi: string;
  estimatedMinutes: number;
  targetId?: string;
  navigationTarget: TodayNavigationTarget;
};

export type LearnerProfileData = {
  level?: string;
  primaryGoal?: string;
  dailyGoalMinutes?: number;
  hasInterviewTarget?: boolean;
  careerGoal?: string;
  portfolioProjects?: string[];
};

export type LearnerStateSnapshot = {
  dueReviewCount: number;
  estimatedReviewMinutes: number;
  /** False when no canonical lesson is stored offline (FR-021 empty hint). */
  hasDownloadedLessons: boolean;
  recentErrors: ErrorEventRecord[];
  speakingRecordings: SpeakingRecordingRecord[];
  lastSpeakingAtIso?: string | null;
  lessonProgression: {
    completedLessonIds: string[];
    nextLessonId?: string | null;
    nextLessonTitle?: string | null;
    nextLessonEstimatedMinutes?: number;
    prerequisiteGapLessonId?: string | null;
    prerequisiteGapTitle?: string | null;
    oldLessonId?: string | null;
    oldLessonTitle?: string | null;
  };
  profileData?: LearnerProfileData | null;
};

export type StudyBlockPlan = {
  mode: TodayMode;
  isConsolidation: boolean;
  totalEstimatedMinutes: number;
  reasonCodes: ReasonCode[];
  explanationVi: string;
  activities: StudyActivityItem[];
};
