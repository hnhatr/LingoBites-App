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
import Config from 'react-native-config';
import {getAppConfig} from '@shared/api/appConfig';
import {simulateDatabaseProcessRestart} from '@/test-support/characterization';
import {PRACTICE_EVENT_TYPE, REVIEW_EVENT_TYPE} from '@shared/db/types';

const CHAR_DB_NAME = `${DB_NAME}-inv002-char`;

export type Inv002ServerStats = {
  practicePosts: number;
  reviewPosts: number;
  practiceEffects: number;
  reviewEffects: number;
};

export type Inv002ProductionPathResult = {
  status: 'pass' | 'fail';
  runtime: 'react-native-quick-sqlite-jsi';
  runId: string;
  assertions: Record<string, boolean | number | string>;
  serverStats: Inv002ServerStats;
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

async function configureServer(
  apiBaseUrl: string,
  config: {practiceFailFirst?: number; reviewFailFirst?: number},
): Promise<void> {
  await fetch(`${apiBaseUrl}/characterization/inv002-config`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(config),
  });
}

async function readServerStats(apiBaseUrl: string): Promise<Inv002ServerStats> {
  const response = await fetch(`${apiBaseUrl}/characterization/inv002-stats`);
  return (await response.json()) as Inv002ServerStats;
}

function pendingCounts() {
  const pending = listPendingSyncEvents();
  return {
    practice: pending.filter(e => e.eventType === PRACTICE_EVENT_TYPE).length,
    review: pending.filter(e => e.eventType === REVIEW_EVENT_TYPE).length,
    total: pending.length,
  };
}

/**
 * Production repositories + withTransaction on real quick-sqlite (simulator JSI).
 */
export async function runInv002ProductionPath(): Promise<Inv002ProductionPathResult> {
  const assertions: Record<string, boolean | number | string> = {};
  let serverStats: Inv002ServerStats = {
    practicePosts: 0,
    reviewPosts: 0,
    practiceEffects: 0,
    reviewEffects: 0,
  };

  try {
    const {apiBaseUrl} = getAppConfig();
    if (!apiBaseUrl.startsWith('http')) {
      throw new Error('invalid apiBaseUrl');
    }

    await configureServer(apiBaseUrl, {practiceFailFirst: 0, reviewFailFirst: 0});

    open({name: CHAR_DB_NAME}).delete();
    resetDatabaseForTests(open({name: CHAR_DB_NAME}));
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

    const initialPending = listPendingSyncEvents();
    const practiceRow = initialPending.find(
      e => e.eventType === PRACTICE_EVENT_TYPE,
    );
    const reviewRow = initialPending.find(
      e => e.eventType === REVIEW_EVENT_TYPE,
    );
    if (!practiceRow || !reviewRow) {
      throw new Error('missing practice or review outbox row');
    }

    const afterEvents = pendingCounts();
    assertions.practicePendingAfterEvents = afterEvents.practice === 1;
    assertions.reviewPendingAfterEvents = afterEvents.review === 1;

    await configureServer(apiBaseUrl, {practiceFailFirst: 1, reviewFailFirst: 1});
    const failedDrain = await drainOutboxOnce({fetchImpl: fetch});
    assertions.firstDrainFailed = failedDrain.status === 'failed';
    const afterFail = pendingCounts();
    assertions.pendingAfterAmbiguousDrain =
      afterFail.practice === 1 && afterFail.review === 1;

    simulateDatabaseProcessRestart(CHAR_DB_NAME);
    const afterRestart = pendingCounts();
    assertions.pendingSurvivesRestart =
      afterRestart.practice === 1 && afterRestart.review === 1;

    await configureServer(apiBaseUrl, {practiceFailFirst: 0, reviewFailFirst: 0});
    const retryDrain = await drainOutboxOnce({fetchImpl: fetch});
    assertions.retryDrainSynced = retryDrain.status === 'synced';
    assertions.pendingAfterRetry = pendingCounts().total === 0;

    const db = getDatabase();
    db.execute(
      `UPDATE sync_outbox
       SET synced_at = NULL, attempt_count = 0, last_error = NULL
       WHERE id IN (?, ?);`,
      [practiceRow.id, reviewRow.id],
    );

    const duplicateDrain = await drainOutboxOnce({fetchImpl: fetch});
    assertions.duplicateDrainSynced = duplicateDrain.status === 'synced';
    assertions.pendingAfterDuplicateDrain = pendingCounts().total === 0;

    serverStats = await readServerStats(apiBaseUrl);
    assertions.onePracticeServerEffect = serverStats.practiceEffects === 1;
    assertions.oneReviewServerEffect = serverStats.reviewEffects === 1;
    assertions.practicePostsIncludeRetry =
      serverStats.practicePosts >= 2;
    assertions.reviewPostsIncludeRetry = serverStats.reviewPosts >= 2;

    const allPass = Object.entries(assertions).every(([, value]) => {
      if (typeof value === 'boolean') {
        return value;
      }
      return true;
    });

    const runId = Config.CHARACTERIZATION_RUN_ID?.trim() ?? '';
    return {
      status: allPass ? 'pass' : 'fail',
      runtime: 'react-native-quick-sqlite-jsi',
      runId,
      assertions,
      serverStats,
    };
  } catch (error) {
    const runId = Config.CHARACTERIZATION_RUN_ID?.trim() ?? '';
    return {
      status: 'fail',
      runtime: 'react-native-quick-sqlite-jsi',
      runId,
      assertions,
      serverStats,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
