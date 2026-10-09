import {AppState, type AppStateStatus} from 'react-native';

import {
  isEvaluationConsentOn,
  queueLessonTaskRecording,
} from '@features/speaking';

import {getDatabase} from '@core/db/database';
import type {
  EvaluationPayload,
  EvaluationTarget,
} from '@core/schemas/evaluation';
import type {LessonSupportLevel} from '@core/schemas/sync';
import {
  createTaskAnswer,
  deleteTaskAnswer,
  getTaskAnswer,
  listUnsentWrittenAnswers,
  saveEvaluation,
  type TaskAnswer,
} from '@core/sync/taskAnswers';

import {
  fetchEvaluation,
  fetchSpeechEvaluationEnabled,
  sendTextEvaluation,
} from './evaluationClient';

/**
 * PR 14: sending step-5 (and summative) answers to the Server's scorer.
 * The attempt itself is recorded by the player as `pending` / `service`;
 * this module keeps the answer, sends it and brings the result back.
 */

const SPEECH_ENABLED_KEY = 'evaluation.speech_enabled';
const CURRENT_ACCOUNT_ID_KEY = 'current_account_id';

/** Decision A8: ask every 2 s for up to 20 s, then wait for sync. */
export const POLL_INTERVAL_MS = 2_000;
export const POLL_TIMEOUT_MS = 20_000;
/** Decision H10: an answer still without a result after a day is let go. */
export const ANSWER_EXPIRY_MS = 24 * 60 * 60 * 1000;

function readSetting(key: string): string | null {
  const row = getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

export function currentAccountId(): string | null {
  return readSetting(CURRENT_ACCOUNT_ID_KEY);
}

/** Last known answer of the Server (decision H5); false until it says yes. */
export function speechEvaluationKnownEnabled(): boolean {
  return readSetting(SPEECH_ENABLED_KEY) === 'true';
}

/** Ask the Server again and remember the answer for offline use. */
export async function refreshSpeechEvaluation(
  fetchImpl?: typeof fetch,
): Promise<boolean> {
  const enabled = await fetchSpeechEvaluationEnabled(fetchImpl);
  if (enabled !== null) {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [SPEECH_ENABLED_KEY, String(enabled), new Date().toISOString()],
    );
    return enabled;
  }
  return speechEvaluationKnownEnabled();
}

/** Spoken answers are graded only when the Server grades them and the learner agreed. */
export function speechGradingReady(): boolean {
  return speechEvaluationKnownEnabled() && isEvaluationConsentOn();
}

export type SubmitResult =
  | {status: 'evaluated'; evaluation: EvaluationPayload}
  /** Kept on the device; the result comes once it is sent and graded. */
  | {status: 'waiting'}
  /** The Server refused the answer (task gone, wrong mode): nothing to wait for. */
  | {status: 'rejected'};

/**
 * A written answer (writing task, or written instead of spoken). It is
 * stored with its text until sent, then graded at once.
 */
export async function submitWrittenAnswer(
  input: {
    attemptId: string;
    target: EvaluationTarget;
    taskId: string;
    text: string;
    substitute: boolean;
    supportLevel: LessonSupportLevel;
  },
  fetchImpl?: typeof fetch,
): Promise<SubmitResult> {
  createTaskAnswer({
    attemptId: input.attemptId,
    ownerUserId: currentAccountId(),
    target: input.target,
    taskId: input.taskId,
    source: 'text',
    substitute: input.substitute,
    supportLevel: input.supportLevel,
    pendingText: input.text,
    state: 'waiting_upload',
  });
  const answer = getTaskAnswer(input.attemptId);
  return answer ? sendWrittenAnswer(answer, fetchImpl) : {status: 'rejected'};
}

async function sendWrittenAnswer(
  answer: TaskAnswer,
  fetchImpl?: typeof fetch,
): Promise<SubmitResult> {
  if (!answer.target || !answer.pendingText) return {status: 'rejected'};
  const result = await sendTextEvaluation(
    {
      attempt_id: answer.attemptId,
      target: answer.target,
      text: answer.pendingText,
      support_level: answer.supportLevel,
      substitute: answer.substitute,
    },
    fetchImpl,
  );
  if (result.ok) {
    saveEvaluation(result.evaluation);
    return {status: 'evaluated', evaluation: result.evaluation};
  }
  if (result.retryable) return {status: 'waiting'};
  deleteTaskAnswer(answer.attemptId);
  return {status: 'rejected'};
}

/** Send written answers that waited for the network, oldest first. */
export async function sendWaitingWrittenAnswers(
  fetchImpl?: typeof fetch,
): Promise<number> {
  let sent = 0;
  for (const answer of listUnsentWrittenAnswers()) {
    const result = await sendWrittenAnswer(answer, fetchImpl);
    if (result.status === 'waiting') break;
    sent += 1;
  }
  return sent;
}

let appStateSubscription: {remove: () => void} | null = null;

/** Retry waiting written answers whenever the app comes to the foreground. */
export function initWrittenAnswerQueue(): void {
  sendWaitingWrittenAnswers().catch(() => undefined);
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active') {
        sendWaitingWrittenAnswers().catch(() => undefined);
      }
    },
  );
}

/** A spoken answer: recorded file handed to the upload queue. */
export function submitSpokenAnswer(input: {
  attemptId: string;
  recordingId: string;
  target: EvaluationTarget;
  taskId: string;
  supportLevel: LessonSupportLevel;
  filePath: string;
  durationMs: number;
}): void {
  queueLessonTaskRecording({
    recordingId: input.recordingId,
    attemptId: input.attemptId,
    ownerUserId: currentAccountId(),
    target: input.target,
    taskId: input.taskId,
    supportLevel: input.supportLevel,
    filePath: input.filePath,
    durationMs: input.durationMs,
  });
}

/**
 * Wait for a spoken answer's result (decision A8). Stops early when the
 * result arrives another way (sync pull) or `shouldStop` says so (the
 * learner left the screen); null when it did not come in time.
 */
export async function pollEvaluation(
  attemptId: string,
  options: {
    fetchImpl?: typeof fetch;
    intervalMs?: number;
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    shouldStop?: () => boolean;
  } = {},
): Promise<EvaluationPayload | null> {
  const interval = options.intervalMs ?? POLL_INTERVAL_MS;
  const timeout = options.timeoutMs ?? POLL_TIMEOUT_MS;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const deadline = now() + timeout;
  while (now() < deadline) {
    if (options.shouldStop?.()) return null;
    const local = getTaskAnswer(attemptId)?.evaluation;
    if (local) return local;
    const fetched = await fetchEvaluation(attemptId, options.fetchImpl);
    if (fetched.status === 'ready') {
      saveEvaluation(fetched.evaluation);
      return fetched.evaluation;
    }
    await sleep(interval);
  }
  return getTaskAnswer(attemptId)?.evaluation ?? null;
}

/** Decision H10: no result a day after the answer was given. */
export function answerExpired(
  answer: TaskAnswer,
  now: number = Date.now(),
): boolean {
  return (
    answer.evaluation === null &&
    now - Date.parse(answer.createdAt) >= ANSWER_EXPIRY_MS
  );
}
