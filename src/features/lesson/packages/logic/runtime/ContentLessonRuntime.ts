/**
 * Lesson runtime engine (SETE-108 / M3).
 *
 * `LessonRuntimeSession` walks a learner through the steps built by
 * `buildLessonSteps`, tracks a `completed | skipped | failed` attempt state
 * per step, and on `finish()` creates SRS review rows for every M1-declared
 * `srs_items` entry whose `source_ref_id` was actually covered by a
 * *completed* step (chunk, Q&A item, or dialogue turn) — never by a skipped
 * one. All DB access is isolated to `loadLessonRuntimeData` and `finish`, so
 * `buildLessonSteps` and the attempt-tracking logic stay unit-testable
 * without SQLite.
 */

import {
  getContentLessonById,
  getLessonActivities,
  getLessonAudioAssets,
  getLessonChunks,
  getLessonSrsItems,
  insertContentReviewItems,
} from '../data/ContentRuntimeRepository';
import {buildLessonSteps} from './buildLessonSteps';
import type {
  LessonRuntimeData,
  LessonRuntimeFinishResult,
  RuntimeAttemptState,
  RuntimeStep,
} from './types';

export function loadLessonRuntimeData(
  lessonId: string,
): LessonRuntimeData | null {
  const lesson = getContentLessonById(lessonId);
  if (!lesson) {
    return null;
  }
  return {
    lesson,
    chunks: getLessonChunks(lessonId),
    activities: getLessonActivities(lessonId),
    audioAssets: getLessonAudioAssets(lessonId),
    srsItems: getLessonSrsItems(lessonId),
  };
}

export class LessonRuntimeSession {
  readonly data: LessonRuntimeData;
  readonly steps: RuntimeStep[];
  private readonly attempts: Map<string, RuntimeAttemptState>;
  private index = 0;

  constructor(data: LessonRuntimeData) {
    this.data = data;
    this.steps = buildLessonSteps(data);
    this.attempts = new Map(
      this.steps.map(step => [step.id, 'pending' as const]),
    );
  }

  getCurrentStep(): RuntimeStep | null {
    return this.steps[this.index] ?? null;
  }

  getStepIndex(): number {
    return this.index;
  }

  getAttempt(stepId: string): RuntimeAttemptState {
    return this.attempts.get(stepId) ?? 'pending';
  }

  getAttempts(): ReadonlyMap<string, RuntimeAttemptState> {
    return this.attempts;
  }

  isFinished(): boolean {
    return this.index >= this.steps.length;
  }

  /** Moves back one step so the learner can revisit the previous card. */
  goToPreviousStep(): boolean {
    if (this.index <= 0) {
      return false;
    }
    this.index -= 1;
    const step = this.getCurrentStep();
    if (step) {
      this.attempts.set(step.id, 'pending');
    }
    return true;
  }

  /** Records the current step's outcome and advances to the next one. */
  recordAttempt(state: RuntimeAttemptState): void {
    const step = this.getCurrentStep();
    if (!step) {
      return;
    }
    this.attempts.set(step.id, state);
    this.index += 1;
  }

  /** Content ids (chunk / qa item / dialogue turn) covered by completed steps. */
  private completedContentRefIds(): Set<string> {
    const refIds = new Set<string>();
    for (const step of this.steps) {
      if (this.getAttempt(step.id) !== 'completed') {
        continue;
      }
      for (const id of step.chunkIds) {
        refIds.add(id);
      }
      for (const id of step.qaItemIds) {
        refIds.add(id);
      }
      for (const id of step.dialogueTurnIds) {
        refIds.add(id);
      }
    }
    // A grammar pattern is "completed" whenever a chunk that declares it was
    // completed — patterns have no dedicated step of their own.
    for (const chunk of this.data.chunks) {
      if (refIds.has(chunk.id)) {
        for (const grammarId of chunk.grammarRefIds) {
          refIds.add(grammarId);
        }
      }
    }
    return refIds;
  }

  /**
   * Finalizes the session: creates a `content_review_items` row for every
   * declared SRS item whose `source_ref_id` was completed. Safe to call more
   * than once — the repository upserts on `srs_item_id`, so replays never
   * duplicate rows.
   */
  finish(now: string = new Date().toISOString()): LessonRuntimeFinishResult {
    const completedRefIds = this.completedContentRefIds();
    const eligible = this.data.srsItems.filter(item =>
      completedRefIds.has(item.source_ref_id),
    );
    const {createdCount} = insertContentReviewItems(
      this.data.lesson.id,
      this.data.lesson.packageId,
      eligible,
      now,
    );

    let completedStepCount = 0;
    let skippedStepCount = 0;
    for (const state of this.attempts.values()) {
      if (state === 'completed') {
        completedStepCount += 1;
      } else if (state === 'skipped') {
        skippedStepCount += 1;
      }
    }

    return {
      createdReviewItemCount: createdCount,
      completedStepCount,
      skippedStepCount,
    };
  }
}

export function createLessonRuntimeSession(
  lessonId: string,
): LessonRuntimeSession | null {
  const data = loadLessonRuntimeData(lessonId);
  if (!data) {
    return null;
  }
  return new LessonRuntimeSession(data);
}
