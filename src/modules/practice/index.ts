export {PracticeScreen} from './PracticeScreen';
export type {PracticeRouteParams, PracticeScreenProps} from './PracticeScreen';
export {PracticeEntryCard} from './PracticeEntryCard';
export {gradeAnswer, isGradable, GRADER_VERSION} from './grader';
export type {GradeOutcome} from './grader';
export {
  calculateResultSummary,
  accuracyOverGraded,
  CALCULATOR_VERSION,
} from './resultSummary';
export {
  createSession,
  retrySession,
  answerCurrentQuestion,
  resumeSession,
  pauseSession,
  abandonSession,
  summarizeSession,
} from './sessionEngine';
export type {SessionSnapshot, AnswerInput} from './sessionEngine';
export {preparePracticeSet, hashPracticeConfig} from './practiceFlow';
export type {PreparePracticeResult} from './practiceFlow';
export {
  projectPracticeUi,
  type PracticeUiProjection,
  type PracticeUiState,
} from './practiceUiProjection';
export {
  isLessonEligibleForPractice,
  hasMinimumValidatedSource,
  isTerminalLessonForPractice,
} from './practiceEligibility';
export type {PracticeEligibleLesson} from './practiceEligibility';
export type {PracticeQuestion as LegacyPracticeQuestion} from './practiceQuestion';
export {usePracticeController} from './usePracticeController';
export {usePracticeSessionScreen} from './usePracticeSessionScreen';
export {resolveQuickPractice} from './resolveQuickPractice';
export {markPracticeEventsSynced} from './data/PracticeRepository';
export {
  pushPracticeEvents,
  type PushPracticeEventsResult,
  type SyncPracticeEvent,
} from './api/practiceEventsClient';
