import {
  getAnswerEvents,
  getPracticeSession,
  getPracticeSet,
  listPracticeSessionsForSet,
  recordAnswerEvent,
  savePracticeSession,
} from './data/PracticeRepository';
import {createRequestId} from '@shared/api/requestId';
import {PRACTICE_CONTRACT_VERSION} from '@shared/schemas/practice';
import type {
  AnswerEvent,
  PracticeQuestion,
  PracticeSession,
  PracticeSet,
  ResultSummary,
} from '@shared/schemas/practice';
import {gradeAnswer} from './grader';
import {calculateResultSummary} from './resultSummary';

export type SessionSnapshot = {
  session: PracticeSession;
  set: PracticeSet;
  events: AnswerEvent[];
  currentQuestion: PracticeQuestion | undefined;
  answered: number;
  correct: number;
  gradedAnswered: number;
  accuracy: number;
  isFinished: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function questionsById(set: PracticeSet): Map<string, PracticeQuestion> {
  return new Map(set.questions.map(q => [q.id, q]));
}

function validateOrder(set: PracticeSet, order: readonly string[]): void {
  const ids = set.questions.map(q => q.id);
  if (order.length !== ids.length) {
    throw new Error(
      `question_order must contain each question exactly once (got ${order.length}, set has ${ids.length})`,
    );
  }
  const seen = new Set(order);
  if (seen.size !== order.length || !ids.every(id => seen.has(id))) {
    throw new Error('question_order must contain each question exactly once');
  }
}

function nextAttemptNo(setId: string): number {
  const existing = listPracticeSessionsForSet(setId);
  return existing.reduce((max, s) => Math.max(max, s.attempt_no), 0) + 1;
}

/**
 * Create a new practice session. The question order is frozen at creation
 * and persisted — resume never recomputes it. Progress lives in the
 * repository (P8 tables), never in component state.
 *
 * "Làm lại" (retry) goes through {@link retrySession}, which allocates a
 * fresh session + `attempt_no` and leaves history untouched.
 */
export function createSession(args: {
  set: PracticeSet;
  attemptNo?: number;
  sessionId?: string;
  questionOrder?: readonly string[];
  now?: string;
}): PracticeSession {
  const {set} = args;
  const order = args.questionOrder
    ? [...args.questionOrder]
    : set.questions.map(q => q.id);
  validateOrder(set, order);
  const timestamp = args.now ?? nowIso();
  const session: PracticeSession = {
    id: args.sessionId ?? createRequestId(),
    practice_set_id: set.id,
    set_revision: set.set_revision,
    lesson_id: set.lesson_id,
    lesson_revision: set.lesson_revision,
    status: 'in_progress',
    question_order: order,
    current_index: 0,
    attempt_no: args.attemptNo ?? nextAttemptNo(set.id),
    started_at: timestamp,
    updated_at: timestamp,
  };
  savePracticeSession(session);
  return session;
}

/**
 * Start a retry ("Làm lại"): a brand-new session over the same set with a
 * new `attempt_no`. The previous session and its events are preserved —
 * history is never deleted.
 */
export function retrySession(args: {
  sessionId: string;
  newSessionId?: string;
  now?: string;
}): PracticeSession {
  const previous = getPracticeSession(args.sessionId);
  if (!previous) {
    throw new Error(`practice session not found: ${args.sessionId}`);
  }
  const set = getPracticeSet(previous.practice_set_id);
  if (!set) {
    throw new Error(`practice set not found: ${previous.practice_set_id}`);
  }
  return createSession({
    set,
    sessionId: args.newSessionId,
    questionOrder: previous.question_order,
    now: args.now,
  });
}

export type AnswerInput = {
  sessionId: string;
  selectedOptionId: string;
  eventId?: string;
  answeredAt?: string;
  durationMs?: number;
};

/**
 * Grade the current question by option ID and persist the answer event plus
 * the session cursor in a single transaction (via `recordAnswerEvent`).
 * Pure grading; no network or AI at runtime.
 */
export function answerCurrentQuestion(input: AnswerInput): {
  session: PracticeSession;
  event: AnswerEvent;
} {
  const session = getPracticeSession(input.sessionId);
  if (!session) {
    throw new Error(`practice session not found: ${input.sessionId}`);
  }
  if (session.status !== 'in_progress') {
    throw new Error(`session ${session.id} is not in progress`);
  }
  const set = getPracticeSet(session.practice_set_id);
  if (!set) {
    throw new Error(`practice set not found: ${session.practice_set_id}`);
  }
  const byId = questionsById(set);
  const questionId = session.question_order[session.current_index];
  const question = questionId ? byId.get(questionId) : undefined;
  if (!question) {
    throw new Error(
      `question ${questionId ?? '(missing)'} not found in set ${set.id}`,
    );
  }

  const outcome = gradeAnswer(question, input.selectedOptionId);
  const events = getAnswerEvents(session.id);
  const timestamp = input.answeredAt ?? nowIso();
  const event: AnswerEvent = {
    event_id: input.eventId ?? createRequestId(),
    contract_version: PRACTICE_CONTRACT_VERSION,
    session_id: session.id,
    question_id: question.id,
    sequence: events.length + 1,
    selected_option_id: input.selectedOptionId,
    is_correct: outcome.graded ? outcome.isCorrect : false,
    answered_at: timestamp,
    duration_ms: input.durationMs ?? 0,
    try_index: 1,
    grading: {
      mode: 'device_deterministic',
      grader_version: outcome.graderVersion,
    },
  };

  const nextIndex = session.current_index + 1;
  const finished = nextIndex >= session.question_order.length;
  recordAnswerEvent(event, {
    status: finished ? 'completed' : 'in_progress',
    current_index: nextIndex,
    updated_at: timestamp,
    completed_at: finished ? timestamp : undefined,
  });

  const updated = getPracticeSession(session.id);
  if (!updated) {
    throw new Error(`practice session lost after answer: ${session.id}`);
  }
  return {session: updated, event};
}

/**
 * Reload a session from the repository — the crash/kill recovery path.
 * Returns the frozen order, the exact cursor, and counters rebuilt from
 * the persisted event log.
 */
export function resumeSession(sessionId: string): SessionSnapshot {
  const session = getPracticeSession(sessionId);
  if (!session) {
    throw new Error(`practice session not found: ${sessionId}`);
  }
  const set = getPracticeSet(session.practice_set_id);
  if (!set) {
    throw new Error(`practice set not found: ${session.practice_set_id}`);
  }
  return buildSnapshot(session, set, getAnswerEvents(session.id));
}

/** Pause is a no-op on the state machine: progress is already persisted per answer. */
export function pauseSession(sessionId: string): PracticeSession {
  const session = getPracticeSession(sessionId);
  if (!session) {
    throw new Error(`practice session not found: ${sessionId}`);
  }
  return session;
}

export function abandonSession(
  sessionId: string,
  now?: string,
): PracticeSession {
  const session = getPracticeSession(sessionId);
  if (!session) {
    throw new Error(`practice session not found: ${sessionId}`);
  }
  if (session.status !== 'in_progress') {
    return session;
  }
  const updated: PracticeSession = {
    ...session,
    status: 'abandoned',
    updated_at: now ?? nowIso(),
    completed_at: now ?? nowIso(),
  };
  savePracticeSession(updated);
  return updated;
}

function buildSnapshot(
  session: PracticeSession,
  set: PracticeSet,
  events: AnswerEvent[],
): SessionSnapshot {
  const byId = questionsById(set);
  let correct = 0;
  let gradedAnswered = 0;
  for (const event of events) {
    const question = byId.get(event.question_id);
    const gradable =
      question !== undefined &&
      (question.options ?? []).some(
        option => option.id === question.correct_option_id,
      );
    // Events for unknown questions were graded at answer time; trust them.
    if (question === undefined || gradable) {
      gradedAnswered += 1;
      if (event.is_correct) {
        correct += 1;
      }
    }
  }
  const currentQuestion =
    session.current_index < session.question_order.length
      ? byId.get(session.question_order[session.current_index])
      : undefined;
  const accuracy =
    gradedAnswered <= 0 ? 0 : Math.round((correct / gradedAnswered) * 100);
  return {
    session,
    set,
    events,
    currentQuestion,
    answered: events.length,
    correct,
    gradedAnswered,
    accuracy,
    isFinished: session.status === 'completed',
  };
}

/**
 * Compute the offline result summary for a session (score + per-skill
 * breakdown + review candidates). Deterministic and network-free; the
 * server recomputes from the event log and never trusts this as authority.
 */
export function summarizeSession(args: {
  sessionId: string;
  summaryId?: string;
  calculatedAt?: string;
}): ResultSummary {
  const snapshot = resumeSession(args.sessionId);
  return calculateResultSummary({
    sessionId: snapshot.session.id,
    summaryId: args.summaryId ?? createRequestId(),
    questionOrder: snapshot.session.question_order,
    questionsById: questionsById(snapshot.set),
    events: snapshot.events,
    calculatedAt: args.calculatedAt ?? nowIso(),
  });
}
