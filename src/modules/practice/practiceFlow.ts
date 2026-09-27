import {sha256Hex} from '../../shared/utils/sha256';
import {
  createPracticeSetApi,
  getPracticeSetApi,
  type PracticeConfigInput,
} from '../../shared/api/practiceClient';
import {
  findActiveSessionLocally,
  findReusablePracticeSetLocally,
  getPracticeSet,
  savePracticeSet,
} from './data/PracticeRepository';
import type {PracticeSet, PracticeSession} from '../../shared/schemas/practice';

export function hashPracticeConfig(config: PracticeConfigInput): string {
  const normalized = JSON.stringify({
    types: [...config.types].sort(),
    difficulty: config.difficulty,
    question_count: config.question_count,
  });
  return sha256Hex(normalized);
}

export type PreparePracticeResult =
  | {
      status: 'ready';
      practiceSet: PracticeSet;
      sessionToResume?: PracticeSession;
      hasVersionMismatchWarning: boolean;
    }
  | {
      status:
        | 'generation_failed'
        | 'invalidated'
        | 'not_found'
        | 'network_error';
      message?: string;
    }
  | {
      /** Server refused generation (HTTP 422) — caller should explain, not retry. */
      status: 'rejected';
      code: string;
    };

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function preparePracticeSet(
  lessonId: string,
  lessonRevision: number,
  config: PracticeConfigInput,
  idempotencyKey: string,
): Promise<PreparePracticeResult> {
  try {
    // 1. Check if there's an active session
    const activeSession = findActiveSessionLocally(lessonId);
    if (activeSession) {
      const existingSet = getPracticeSet(activeSession.practice_set_id);
      if (existingSet) {
        const hasMismatch = existingSet.lesson_revision !== lessonRevision;
        return {
          status: 'ready',
          practiceSet: existingSet,
          sessionToResume: activeSession,
          hasVersionMismatchWarning: hasMismatch,
        };
      }
    }

    // 2. Check local reuse (set not started or started but completed/abandoned can be reused if same config & revision)
    const configHash = hashPracticeConfig(config);
    const reusableLocally = findReusablePracticeSetLocally(
      lessonId,
      lessonRevision,
      configHash,
    );
    if (reusableLocally) {
      return {
        status: 'ready',
        practiceSet: reusableLocally,
        hasVersionMismatchWarning: false,
      };
    }

    // 3. Call API to create/reuse
    const createRes = await createPracticeSetApi(
      lessonId,
      lessonRevision,
      config,
      idempotencyKey,
    );

    if (createRes.status === 'reused') {
      savePracticeSet(createRes.practiceSet);
      return {
        status: 'ready',
        practiceSet: createRes.practiceSet,
        hasVersionMismatchWarning: false,
      };
    }

    if (createRes.status === 'rejected') {
      return {status: 'rejected', code: createRes.code};
    }

    if (
      createRes.status === 'generation_failed' ||
      createRes.status === 'invalidated'
    ) {
      return {status: createRes.status};
    }

    // 4. Poll until ready
    let currentSetId = createRes.practiceSetId;
    let pollAfter = createRes.pollAfterMs || 1000;

    while (true) {
      await delay(pollAfter);
      const getRes = await getPracticeSetApi(lessonId, currentSetId);

      if (getRes.status === 'ready') {
        savePracticeSet(getRes.practiceSet);
        return {
          status: 'ready',
          practiceSet: getRes.practiceSet,
          hasVersionMismatchWarning: false,
        };
      } else if (getRes.status === 'generating') {
        pollAfter = getRes.pollAfterMs || 1000;
      } else {
        return {status: getRes.status};
      }
    }
  } catch (error: any) {
    return {
      status: 'network_error',
      message: error.message,
    };
  }
}
