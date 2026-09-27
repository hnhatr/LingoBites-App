/**
 * Public types for the lesson runtime engine (SETE-108 / M3).
 *
 * The engine turns one imported lesson (chunks + declared activities) into
 * an ordered sequence of `RuntimeStep`s covering every activity type in the
 * task: context-first input, guided practice, shadowing, active recall,
 * role-play, an exit check, and a closing feedback card.
 */

import type {
  ContentActivityRow,
  ContentChunkRow,
  ContentLessonRow,
} from '@shared/db/ContentRuntimeRepository';
import type {
  AudioAsset,
  CheckOutcome,
  DialogueTurn,
  QAItem,
  SrsItem,
} from '../schema';

export type RuntimeStepKind =
  | 'context'
  | 'guided_practice'
  | 'shadowing'
  | 'active_recall'
  | 'role_play'
  | 'exit_check'
  | 'feedback';

export type RuntimeAttemptState =
  | 'pending'
  | 'completed'
  | 'skipped'
  | 'failed';

export type ContextStepData = {
  kind: 'context';
  phraseEn: string;
  phraseVi: string;
  explanationVi: string;
  contextSentenceEn: string | null;
  contextSentenceVi: string | null;
  audioAssetId: string | null;
};

export type GuidedPracticeStepData = {
  kind: 'guided_practice';
  titleVi: string;
  instructionsVi: string | null;
  items: QAItem[];
};

export type ShadowingLine = {
  textEn: string;
  textVi: string;
  audioAssetId: string | null;
};

export type ShadowingStepData = {
  kind: 'shadowing';
  titleVi: string;
  instructionsVi: string | null;
  lines: ShadowingLine[];
};

export type ActiveRecallStepData = {
  kind: 'active_recall';
  titleVi: string;
  instructionsVi: string | null;
  items: QAItem[];
};

export type RolePlayStepData = {
  kind: 'role_play';
  titleVi: string;
  instructionsVi: string | null;
  turns: DialogueTurn[];
};

export type ExitCheckStepData = {
  kind: 'exit_check';
  items: QAItem[];
};

export type FeedbackStepData = {
  kind: 'feedback';
  newChunkCount: number;
  completedCount: number;
  skippedCount: number;
  nextReviewHint: string;
  checkCorrectCount?: number;
  checkTotalCount?: number;
  checkScorePercentage?: number;
  checkOutcome?: CheckOutcome;
  checkFeedbackVi?: string;
};

export type RuntimeStepData =
  | ContextStepData
  | GuidedPracticeStepData
  | ShadowingStepData
  | ActiveRecallStepData
  | RolePlayStepData
  | ExitCheckStepData
  | FeedbackStepData;

/**
 * One step in the runtime sequence. `chunkIds` / `qaItemIds` /
 * `dialogueTurnIds` record which M1 content ids this step "covers" — used on
 * exit to decide which declared SRS items graduate to `content_review_items`.
 * `chunkIds` is only ever populated on `context` steps: a chunk counts as
 * "completed" solely when its own context step was completed, not merely
 * because a later activity happens to reference it.
 */
type RuntimeStepBase = {
  id: string;
  chunkIds: string[];
  qaItemIds: string[];
  dialogueTurnIds: string[];
};

// A discriminated union keyed on `data.kind` (not a separate `kind` field) so
// `step.data` narrows correctly wherever a caller switches on `step.kind`.
export type RuntimeStep = RuntimeStepBase &
  (
    | {kind: 'context'; data: ContextStepData}
    | {kind: 'guided_practice'; data: GuidedPracticeStepData}
    | {kind: 'shadowing'; data: ShadowingStepData}
    | {kind: 'active_recall'; data: ActiveRecallStepData}
    | {kind: 'role_play'; data: RolePlayStepData}
    | {kind: 'exit_check'; data: ExitCheckStepData}
    | {kind: 'feedback'; data: FeedbackStepData}
  );

/** Denormalized lesson content the step builder needs; DB-agnostic. */
export type LessonRuntimeData = {
  lesson: ContentLessonRow;
  chunks: ContentChunkRow[];
  activities: ContentActivityRow[];
  audioAssets: Map<string, AudioAsset>;
  srsItems: SrsItem[];
};

export type LessonRuntimeFinishResult = {
  createdReviewItemCount: number;
  completedStepCount: number;
  skippedStepCount: number;
};

export type ContentLessonListRouteParams = undefined;

export type ContentLessonDetailRouteParams = {
  lessonId: string;
};

export type ContentLessonRuntimeRouteParams = {
  lessonId: string;
};
