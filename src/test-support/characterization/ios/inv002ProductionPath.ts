import {validFullOutput} from '@shared/fixtures';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {listPendingSyncEvents} from '@shared/db/SyncOutboxRepository';
import {
  recordFlashcardRating,
  saveFlashcard,
} from '@shared/db/FlashcardRepository';
import {savePracticeSet} from '@shared/db/PracticeRepository';
import {
  answerCurrentQuestion,
  createSession,
} from '@modules/practice/sessionEngine';
import type {PracticeSet} from '@shared/schemas/practice';
import {drainOutboxOnce} from '@modules/sync/outboxSync';
import {getAppConfig} from '@shared/api/appConfig';

export type Inv002ProductionPathResult = {
  status: 'pass' | 'fail';
  runtime: 'react-native-quick-sqlite-jsi';
  practicePendingAfterAnswer: number;
  reviewPendingAfterRating: number;
  drainStatus: string;
  pendingAfterDrain: number;
  error?: string;
};

function makePracticeSet(): PracticeSet {
  return {
    id: 'char-ios-set',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-ios',
    lesson_revision: 1,
    source_fingerprint: 'fp',
    config_hash: 'hash',
    difficulty: 'beginner',
    requested_count: 1,
    set_revision: 1,
    generator: {
      provider: 'test',
      model: 'test',
      prompt_version: 'v1',
      generator_version: 'v1',
    },
    questions: [
      {
        id: 'q1',
        variant: 'meaning_choice',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: 'Chon',
        explanation_vi: 'Vi',
        source_refs: [{kind: 'vocabulary', id: 'v1'}],
        source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v1',
        options: [
          {id: 'q1-opt-1', text: 'a'},
          {id: 'q1-opt-2', text: 'b'},
        ],
        correct_option_id: 'q1-opt-1',
      },
    ],
    created_at: '2026-09-27T10:00:00.000Z',
    ready_at: '2026-09-27T10:01:00.000Z',
  };
}

/**
 * Production repositories + withTransaction on real quick-sqlite (simulator JSI).
 */
export async function runInv002ProductionPath(): Promise<Inv002ProductionPathResult> {
  try {
    resetDatabaseForTests(open({name: `${DB_NAME}-inv002-char`}));
    getDatabase();

    savePracticeSet(makePracticeSet());
    createSession({set: makePracticeSet(), sessionId: 'sess-ios'});
    answerCurrentQuestion({
      sessionId: 'sess-ios',
      selectedOptionId: 'q1-opt-1',
      eventId: 'ev-ios-practice',
      answeredAt: '2026-09-27T10:06:00.000Z',
    });

    const saved = saveFlashcard({
      lessonId: 'lesson-ios-review',
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-09-27T10:00:00.000Z',
    });
    if (!saved.ok) {
      throw new Error('saveFlashcard failed');
    }
    recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-09-27T10:07:00.000Z',
    });

    const pendingMid = listPendingSyncEvents();
    const practicePending = pendingMid.filter(
      e => e.eventType === 'practice',
    ).length;
    const reviewPending = pendingMid.filter(
      e => e.eventType === 'review',
    ).length;

    const {apiBaseUrl} = getAppConfig();
    const drain = await drainOutboxOnce({fetchImpl: fetch});
    const pendingAfter = listPendingSyncEvents().length;

    return {
      status:
        practicePending === 1 &&
        reviewPending === 1 &&
        drain.status === 'synced' &&
        pendingAfter === 0
          ? 'pass'
          : 'fail',
      runtime: 'react-native-quick-sqlite-jsi',
      practicePendingAfterAnswer: practicePending,
      reviewPendingAfterRating: reviewPending,
      drainStatus: drain.status,
      pendingAfterDrain: pendingAfter,
      error:
        apiBaseUrl.startsWith('http') ? undefined : 'invalid apiBaseUrl',
    };
  } catch (error) {
    return {
      status: 'fail',
      runtime: 'react-native-quick-sqlite-jsi',
      practicePendingAfterAnswer: -1,
      reviewPendingAfterRating: -1,
      drainStatus: 'error',
      pendingAfterDrain: -1,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
