import {getDatabase} from '@core/db/database';
import {
  type EvaluationPayload,
  EvaluationPayloadSchema,
  type EvaluationTarget,
} from '@core/schemas/evaluation';
import type {
  LessonSupportLevel,
  SyncPullRecord,
  SyncRecord,
} from '@core/schemas/sync';

/**
 * PR 14: answers sent to the Server's scorer (`task_answers`, schema v9) and
 * their results. A written answer waiting for the network keeps its text in
 * `pending_text` on this device only; it is cleared once sent.
 */

export type TaskAnswerState = 'waiting_upload' | 'sent' | 'evaluated';

export type TaskAnswer = {
  attemptId: string;
  target: EvaluationTarget | null;
  source: 'speech' | 'text';
  substitute: boolean;
  supportLevel: LessonSupportLevel;
  recordingId: string | null;
  pendingText: string | null;
  state: TaskAnswerState;
  evaluation: EvaluationPayload | null;
  createdAt: string;
};

type TaskAnswerRow = {
  attempt_id: string;
  lesson_id: string | null;
  block_id: string | null;
  unit_id: string | null;
  task_id: string | null;
  source: string;
  substitute: number;
  support_level: string;
  recording_id: string | null;
  pending_text: string | null;
  state: string;
  evaluation_json: string | null;
  created_at: string;
};

type Listener = () => void;
const listeners = new Set<Listener>();

/** Re-render hooks when a result arrives (send, poll or sync pull). */
export function subscribeTaskAnswers(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

function parseEvaluation(json: string | null): EvaluationPayload | null {
  if (!json) return null;
  try {
    const parsed = EvaluationPayloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function toAnswer(row: TaskAnswerRow): TaskAnswer {
  const target: EvaluationTarget | null =
    row.lesson_id && row.block_id
      ? {lesson_id: row.lesson_id, block_id: row.block_id}
      : row.unit_id && row.task_id
      ? {unit_id: row.unit_id, task_id: row.task_id}
      : null;
  return {
    attemptId: row.attempt_id,
    target,
    source: row.source === 'speech' ? 'speech' : 'text',
    substitute: row.substitute === 1,
    supportLevel: row.support_level as LessonSupportLevel,
    recordingId: row.recording_id,
    pendingText: row.pending_text,
    state: row.state as TaskAnswerState,
    evaluation: parseEvaluation(row.evaluation_json),
    createdAt: row.created_at,
  };
}

export type CreateTaskAnswerInput = {
  attemptId: string;
  ownerUserId: string | null;
  target: EvaluationTarget;
  taskId: string;
  source: 'speech' | 'text';
  substitute: boolean;
  supportLevel: LessonSupportLevel;
  recordingId?: string | null;
  pendingText?: string | null;
  state: TaskAnswerState;
  now?: string;
};

export function createTaskAnswer(input: CreateTaskAnswerInput): void {
  const now = input.now ?? new Date().toISOString();
  const lessonTarget = 'lesson_id' in input.target ? input.target : null;
  const unitTarget = 'unit_id' in input.target ? input.target : null;
  getDatabase().execute(
    `INSERT OR IGNORE INTO task_answers (
      attempt_id, owner_user_id, lesson_id, block_id, unit_id, task_id,
      source, substitute, support_level, recording_id, pending_text, state,
      evaluation_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?);`,
    [
      input.attemptId,
      input.ownerUserId,
      lessonTarget?.lesson_id ?? null,
      lessonTarget?.block_id ?? null,
      unitTarget?.unit_id ?? null,
      input.taskId,
      input.source,
      input.substitute ? 1 : 0,
      input.supportLevel,
      input.recordingId ?? null,
      input.pendingText ?? null,
      input.state,
      now,
      now,
    ],
  );
  notify();
}

export function getTaskAnswer(attemptId: string): TaskAnswer | null {
  const row = getDatabase()
    .execute('SELECT * FROM task_answers WHERE attempt_id = ? LIMIT 1;', [
      attemptId,
    ])
    .rows?.item(0) as TaskAnswerRow | undefined;
  return row ? toAnswer(row) : null;
}

/** The latest answer to a lesson block, if any. */
export function latestTaskAnswerForBlock(blockId: string): TaskAnswer | null {
  const row = getDatabase()
    .execute(
      `SELECT * FROM task_answers WHERE block_id = ?
        ORDER BY created_at DESC LIMIT 1;`,
      [blockId],
    )
    .rows?.item(0) as TaskAnswerRow | undefined;
  return row ? toAnswer(row) : null;
}

function listAnswers(column: 'lesson_id' | 'unit_id', id: string) {
  const rows = getDatabase().execute(
    `SELECT * FROM task_answers WHERE ${column} = ? ORDER BY created_at DESC;`,
    [id],
  ).rows;
  const answers: TaskAnswer[] = [];
  for (let index = 0; index < (rows?.length ?? 0); index += 1) {
    answers.push(toAnswer(rows!.item(index) as TaskAnswerRow));
  }
  return answers;
}

/** Every answer to a lesson's step-5 tasks, newest first (PR 16). */
export function listTaskAnswersForLesson(lessonId: string): TaskAnswer[] {
  return listAnswers('lesson_id', lessonId);
}

/** Every answer to a unit's summative task, newest first (PR 16). */
export function listTaskAnswersForUnit(unitId: string): TaskAnswer[] {
  return listAnswers('unit_id', unitId);
}

/** Written answers still waiting for the network, oldest first. */
export function listUnsentWrittenAnswers(): TaskAnswer[] {
  const rows = getDatabase().execute(
    `SELECT * FROM task_answers
      WHERE source = 'text' AND state = 'waiting_upload' AND pending_text IS NOT NULL
      ORDER BY created_at ASC;`,
  ).rows;
  const answers: TaskAnswer[] = [];
  for (let index = 0; index < (rows?.length ?? 0); index += 1) {
    answers.push(toAnswer(rows!.item(index) as TaskAnswerRow));
  }
  return answers;
}

/** The answer left the device: forget any written text. */
export function markTaskAnswerSent(attemptId: string, now?: string): void {
  getDatabase().execute(
    `UPDATE task_answers SET state = 'sent', pending_text = NULL, updated_at = ?
      WHERE attempt_id = ? AND state = 'waiting_upload';`,
    [now ?? new Date().toISOString(), attemptId],
  );
  notify();
}

/** Back to self-assessment (consent withdrawn): nothing is sent. */
export function deleteTaskAnswer(attemptId: string): void {
  getDatabase().execute('DELETE FROM task_answers WHERE attempt_id = ?;', [
    attemptId,
  ]);
  notify();
}

/**
 * Store a result (from the send, a poll or a sync pull). An answer made on
 * another device has no local row yet: one is created from the result.
 */
export function saveEvaluation(
  evaluation: EvaluationPayload,
  now?: string,
): void {
  const at = now ?? new Date().toISOString();
  const db = getDatabase();
  const json = JSON.stringify(evaluation);
  const updated = db.execute(
    `UPDATE task_answers
        SET state = 'evaluated', evaluation_json = ?, pending_text = NULL, updated_at = ?
      WHERE attempt_id = ?;`,
    [json, at, evaluation.attempt_id],
  );
  if ((updated.rowsAffected ?? 0) === 0) {
    db.execute(
      `INSERT OR IGNORE INTO task_answers (
        attempt_id, owner_user_id, lesson_id, block_id, unit_id, task_id,
        source, substitute, support_level, recording_id, pending_text, state,
        evaluation_json, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'evaluated', ?, ?, ?);`,
      [
        evaluation.attempt_id,
        evaluation.lesson_id,
        evaluation.block_id,
        evaluation.unit_id,
        evaluation.task_id,
        evaluation.source,
        evaluation.substitute ? 1 : 0,
        evaluation.support_level,
        json,
        evaluation.evaluated_at,
        at,
      ],
    );
  }
  notify();
}

/** Pull applier for the read-only `evaluations` collection. */
export function applyEvaluationRecord(
  record: SyncRecord | SyncPullRecord,
): void {
  if (record.tombstone) return;
  const parsed = EvaluationPayloadSchema.safeParse(record.payload);
  if (!parsed.success) return;
  saveEvaluation(parsed.data, record.updated_at);
}
