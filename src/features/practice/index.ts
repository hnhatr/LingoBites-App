export {PracticeScreen} from './screens/PracticeScreen';
export type {
  PracticeRouteParams,
  PracticeScreenProps,
} from './screens/PracticeScreen';
export {PracticeEntryCard} from './components/PracticeEntryCard';
export {gradeAnswer, isGradable, GRADER_VERSION} from './logic/grader';
export type {GradeOutcome} from './logic/grader';
export {
  calculateResultSummary,
  accuracyOverGraded,
  CALCULATOR_VERSION,
} from './logic/resultSummary';
export {
  createSession,
  retrySession,
  answerCurrentQuestion,
  resumeSession,
  pauseSession,
  abandonSession,
  summarizeSession,
} from './logic/sessionEngine';
export type {SessionSnapshot, AnswerInput} from './logic/sessionEngine';
export {preparePracticeSet, hashPracticeConfig} from './logic/practiceFlow';
export type {PreparePracticeResult} from './logic/practiceFlow';
export {
  projectPracticeUi,
  type PracticeUiProjection,
  type PracticeUiState,
} from './logic/practiceUiProjection';
export {
  isLessonEligibleForPractice,
  hasMinimumValidatedSource,
  isTerminalLessonForPractice,
} from './logic/practiceEligibility';
export type {PracticeEligibleLesson} from './logic/practiceEligibility';
export type {PracticeQuestion as LegacyPracticeQuestion} from './logic/practiceQuestion';
export {usePracticeController} from './logic/usePracticeController';
export {usePracticeSessionScreen} from './logic/usePracticeSessionScreen';
export {resolveQuickPractice} from './logic/resolveQuickPractice';
export {markPracticeEventsSynced} from './logic/data/PracticeRepository';
export {
  pushPracticeEvents,
  type PushPracticeEventsResult,
  type SyncPracticeEvent,
} from './logic/api/practiceEventsClient';
