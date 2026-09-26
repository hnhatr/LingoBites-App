import {getDatabase, withTransaction} from './database';
import type {
  PracticeSet,
  PracticeQuestion,
  PracticeSession,
  AnswerEvent,
  MeaningChoice,
  ClozeChoice,
} from '../schemas/practice';
import {PRACTICE_RETENTION} from './constants';
import {PRACTICE_EVENT_TYPE} from './types';
import type {PracticeEventPayload} from './types';

function parseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as T;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

function rows<T>(result: {
  rows?: {length: number; item(index: number): unknown};
}): T[] {
  const items: T[] = [];
  if (result.rows) {
    for (let i = 0; i < result.rows.length; i++) {
      items.push(result.rows.item(i) as T);
    }
  }
  return items;
}

export function savePracticeSet(set: PracticeSet): void {
  const db = getDatabase();
  withTransaction(db, () => {
    db.execute(
      `INSERT OR REPLACE INTO practice_sets (
        id, contract_version, status, lesson_id, lesson_revision,
        source_fingerprint, config_hash, seed, difficulty, requested_count,
        set_revision, generator_json, validation_summary_json, created_at, ready_at, error_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        set.id,
        set.contract_version,
        set.status,
        set.lesson_id,
        set.lesson_revision,
        set.source_fingerprint,
        set.config_hash,
        set.seed ?? null,
        set.difficulty,
        set.requested_count,
        set.set_revision,
        stringifyJson(set.generator),
        set.validation_summary ? stringifyJson(set.validation_summary) : null,
        set.created_at,
        set.ready_at ?? null,
        set.error ? stringifyJson(set.error) : null,
      ],
    );

    for (const q of set.questions) {
      let payload: unknown = {};
      if (q.variant === 'meaning_choice') {
        payload = {
          vocabulary_id: (q as MeaningChoice).vocabulary_id,
          options: (q as MeaningChoice).options,
          correct_option_id: (q as MeaningChoice).correct_option_id,
        };
      } else if (q.variant === 'cloze_choice') {
        payload = {
          sentence_id: (q as ClozeChoice).sentence_id,
          stem_with_placeholder: (q as ClozeChoice).stem_with_placeholder,
          blank: (q as ClozeChoice).blank,
          options: (q as ClozeChoice).options,
          correct_option_id: (q as ClozeChoice).correct_option_id,
        };
      }
      db.execute(
        `INSERT OR REPLACE INTO practice_questions (
          id, practice_set_id, variant, skill, difficulty, prompt_vi, explanation_vi,
          source_refs_json, source_snapshot_json, provenance_json, validation_json, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          set.id,
          q.variant,
          q.skill,
          q.difficulty,
          q.prompt_vi,
          q.explanation_vi,
          stringifyJson(q.source_refs),
          stringifyJson(q.source_snapshot),
          stringifyJson(q.provenance),
          stringifyJson(q.validation),
          stringifyJson(payload),
        ],
      );
    }
  });
}

export function getPracticeSet(id: string): PracticeSet | null {
  const db = getDatabase();
  const setRows = rows<any>(
    db.execute('SELECT * FROM practice_sets WHERE id = ?', [id]),
  );
  if (setRows.length === 0) {
    return null;
  }
  const setRow = setRows[0];

  const qRows = rows<any>(
    db.execute('SELECT * FROM practice_questions WHERE practice_set_id = ?', [
      id,
    ]),
  );

  const questions: PracticeQuestion[] = qRows.map(qr => {
    const base = {
      id: qr.id,
      variant: qr.variant,
      skill: qr.skill,
      difficulty: qr.difficulty,
      prompt_vi: qr.prompt_vi,
      explanation_vi: qr.explanation_vi,
      source_refs: parseJson(qr.source_refs_json)!,
      source_snapshot: parseJson(qr.source_snapshot_json)!,
      provenance: parseJson(qr.provenance_json)!,
      validation: parseJson(qr.validation_json)!,
    };
    const payload = parseJson<any>(qr.payload_json)!;
    if (qr.variant === 'meaning_choice') {
      return {
        ...base,
        vocabulary_id: payload.vocabulary_id,
        options: payload.options,
        correct_option_id: payload.correct_option_id,
      } as MeaningChoice;
    } else {
      return {
        ...base,
        sentence_id: payload.sentence_id,
        stem_with_placeholder: payload.stem_with_placeholder,
        blank: payload.blank,
        options: payload.options,
        correct_option_id: payload.correct_option_id,
      } as ClozeChoice;
    }
  });

  return {
    id: setRow.id,
    contract_version: setRow.contract_version,
    status: setRow.status,
    lesson_id: setRow.lesson_id,
    lesson_revision: setRow.lesson_revision,
    source_fingerprint: setRow.source_fingerprint,
    config_hash: setRow.config_hash,
    seed: setRow.seed || undefined,
    difficulty: setRow.difficulty,
    requested_count: setRow.requested_count,
    set_revision: setRow.set_revision,
    generator: parseJson(setRow.generator_json)!,
    questions,
    validation_summary: parseJson(setRow.validation_summary_json),
    created_at: setRow.created_at,
    ready_at: setRow.ready_at || undefined,
    error: parseJson(setRow.error_json),
  };
}

export function savePracticeSession(session: PracticeSession): void {
  const db = getDatabase();
  db.execute(
    `INSERT OR REPLACE INTO practice_sessions (
      id, practice_set_id, set_revision, lesson_id, lesson_revision, status,
      question_order_json, current_index, attempt_no, started_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.practice_set_id,
      session.set_revision,
      session.lesson_id,
      session.lesson_revision,
      session.status,
      stringifyJson(session.question_order),
      session.current_index,
      session.attempt_no,
      session.started_at,
      session.updated_at,
      session.completed_at ?? null,
    ],
  );
}

export function getPracticeSession(id: string): PracticeSession | null {
  const db = getDatabase();
  const res = rows<any>(
    db.execute('SELECT * FROM practice_sessions WHERE id = ?', [id]),
  );
  if (res.length === 0) return null;
  const row = res[0];
  return {
    id: row.id,
    practice_set_id: row.practice_set_id,
    set_revision: row.set_revision,
    lesson_id: row.lesson_id,
    lesson_revision: row.lesson_revision,
    status: row.status,
    question_order: parseJson(row.question_order_json)!,
    current_index: row.current_index,
    attempt_no: row.attempt_no,
    started_at: row.started_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at || undefined,
  };
}

/**
 * Allowlist payload pushed to the server (P12 / P7 §5). Only source IDs +
 * outcome + timing — never snapshot text, never SRS fields.
 */
export function toPracticeOutboxPayload(
  event: AnswerEvent,
): PracticeEventPayload {
  return {
    event_id: event.event_id,
    contract_version: event.contract_version,
    session_id: event.session_id,
    question_id: event.question_id,
    sequence: event.sequence,
    selected_option_id: event.selected_option_id,
    is_correct: event.is_correct,
    answered_at: event.answered_at,
    duration_ms: event.duration_ms,
    try_index: event.try_index,
    grading: {
      mode: 'device_deterministic',
      grader_version: event.grading.grader_version,
    },
  };
}

export function recordAnswerEvent(
  event: AnswerEvent,
  sessionUpdate: {
    status: PracticeSession['status'];
    current_index: number;
    updated_at: string;
    completed_at?: string;
  },
): void {
  const db = getDatabase();
  withTransaction(db, () => {
    db.execute(
      `INSERT INTO practice_events (
        event_id, contract_version, session_id, question_id, sequence,
        selected_option_id, is_correct, answered_at, duration_ms, try_index,
        grading_json, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.event_id,
        event.contract_version,
        event.session_id,
        event.question_id,
        event.sequence,
        event.selected_option_id,
        event.is_correct ? 1 : 0,
        event.answered_at,
        event.duration_ms,
        event.try_index,
        stringifyJson(event.grading),
        event.sync_status || 'pending',
      ],
    );

    db.execute(
      `UPDATE practice_sessions
       SET status = ?, current_index = ?, updated_at = ?, completed_at = ?
       WHERE id = ?`,
      [
        sessionUpdate.status,
        sessionUpdate.current_index,
        sessionUpdate.updated_at,
        sessionUpdate.completed_at ?? null,
        event.session_id,
      ],
    );

    // P12: append the outbox row in the SAME transaction — no window where
    // a kill after answering loses the event. D4: practice only, no SRS
    // schedule or next_review_at writes here (HI-1/HI-4 preserved).
    db.execute(
      `INSERT INTO sync_outbox (
        id, event_type, entity_id, payload_json, created_at, attempt_count,
        last_error, synced_at
      ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL);`,
      [
        event.event_id,
        PRACTICE_EVENT_TYPE,
        event.session_id,
        stringifyJson(toPracticeOutboxPayload(event)),
        event.answered_at,
      ],
    );
  });
}

/**
 * Mirror of outbox drain state onto `practice_events.sync_status` so
 * D5 retention (`purgeExpiredPracticeData`) can tell synced from pending.
 * HI-5: never mark unsynced rows as synced.
 */
export function markPracticeEventsSynced(eventIds: string[]): number {
  if (eventIds.length === 0) {
    return 0;
  }
  const db = getDatabase();
  let affected = 0;
  for (const id of eventIds) {
    const result = db.execute(
      `UPDATE practice_events SET sync_status = 'synced' WHERE event_id = ?;`,
      [id],
    );
    affected += result.rowsAffected ?? 0;
  }
  return affected;
}

/**
 * All answer events for a session, ordered by sequence. Used by the
 * offline session engine (SETE-204 / P9) to resume after a kill and to
 * rebuild counters without keeping progress in component state.
 */
export function getAnswerEvents(sessionId: string): AnswerEvent[] {
  const db = getDatabase();
  const res = rows<any>(
    db.execute(
      'SELECT * FROM practice_events WHERE session_id = ? ORDER BY sequence ASC',
      [sessionId],
    ),
  );
  return res.map(row => ({
    event_id: row.event_id,
    contract_version: row.contract_version,
    session_id: row.session_id,
    question_id: row.question_id,
    sequence: row.sequence,
    selected_option_id: row.selected_option_id,
    is_correct: row.is_correct === 1,
    answered_at: row.answered_at,
    duration_ms: row.duration_ms,
    try_index: row.try_index,
    grading: parseJson(row.grading_json)!,
    sync_status: row.sync_status,
  }));
}

/**
 * All sessions created for a practice set, ordered by attempt_no.
 * Used to allocate the next `attempt_no` on retry without deleting history.
 */
export function listPracticeSessionsForSet(setId: string): PracticeSession[] {
  const db = getDatabase();
  const res = rows<any>(
    db.execute(
      'SELECT * FROM practice_sessions WHERE practice_set_id = ? ORDER BY attempt_no ASC',
      [setId],
    ),
  );
  return res.map(row => ({
    id: row.id,
    practice_set_id: row.practice_set_id,
    set_revision: row.set_revision,
    lesson_id: row.lesson_id,
    lesson_revision: row.lesson_revision,
    status: row.status,
    question_order: parseJson(row.question_order_json)!,
    current_index: row.current_index,
    attempt_no: row.attempt_no,
    started_at: row.started_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at || undefined,
  }));
}

/**
 * Purge expired practice data based on D5 config policy.
 * HI-5: Never delete in_progress sessions or pending sync events.
 */
export function purgeExpiredPracticeData(nowStr: string): void {
  const db = getDatabase();
  withTransaction(db, () => {
    // 1. Delete events that are synced and older than retention period
    db.execute(
      `DELETE FROM practice_events 
       WHERE sync_status = 'synced' 
       AND strftime('%s', answered_at) < strftime('%s', ?, '-' || ? || ' days')`,
      [nowStr, PRACTICE_RETENTION.EVENTS_SYNCED_DAYS],
    );

    // 2. Delete practice sets (and their questions) that are older than retention
    // AND have no associated sessions that are in_progress
    db.execute(
      `DELETE FROM practice_questions 
       WHERE practice_set_id IN (
         SELECT id FROM practice_sets
         WHERE ready_at IS NOT NULL
           AND strftime('%s', ready_at) < strftime('%s', ?, '-' || ? || ' days')
           AND id NOT IN (
             SELECT practice_set_id FROM practice_sessions WHERE status = 'in_progress'
           )
       )`,
      [nowStr, PRACTICE_RETENTION.SETS_AND_QUESTIONS_DAYS],
    );

    db.execute(
      `DELETE FROM practice_sets 
       WHERE ready_at IS NOT NULL
         AND strftime('%s', ready_at) < strftime('%s', ?, '-' || ? || ' days')
         AND id NOT IN (
           SELECT practice_set_id FROM practice_sessions WHERE status = 'in_progress'
         )`,
      [nowStr, PRACTICE_RETENTION.SETS_AND_QUESTIONS_DAYS],
    );
  });
}

export function findReusablePracticeSetLocally(
  lessonId: string,
  lessonRevision: number,
  configHash: string,
): PracticeSet | null {
  const db = getDatabase();
  const res = db.execute(
    'SELECT id FROM practice_sets WHERE lesson_id = ? AND lesson_revision = ? AND config_hash = ? AND status = ? LIMIT 1',
    [lessonId, lessonRevision, configHash, 'ready'],
  );
  if (res.rows && res.rows.length > 0) {
    return getPracticeSet(res.rows.item(0).id);
  }
  return null;
}

export function findActiveSessionLocally(
  lessonId: string,
): PracticeSession | null {
  const db = getDatabase();
  const res = db.execute(
    'SELECT id FROM practice_sessions WHERE lesson_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 1',
    [lessonId, 'in_progress'],
  );
  if (res.rows && res.rows.length > 0) {
    return getPracticeSession(res.rows.item(0).id);
  }
  return null;
}

export function findLatestPracticeSetForLesson(
  lessonId: string,
): PracticeSet | null {
  const db = getDatabase();
  const res = db.execute(
    `SELECT id FROM practice_sets
     WHERE lesson_id = ?
     ORDER BY COALESCE(ready_at, created_at) DESC
     LIMIT 1`,
    [lessonId],
  );
  if (res.rows && res.rows.length > 0) {
    return getPracticeSet(res.rows.item(0).id);
  }
  return null;
}

export function findLatestSessionForLesson(
  lessonId: string,
): PracticeSession | null {
  const db = getDatabase();
  const res = db.execute(
    `SELECT id FROM practice_sessions
     WHERE lesson_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [lessonId],
  );
  if (res.rows && res.rows.length > 0) {
    return getPracticeSession(res.rows.item(0).id);
  }
  return null;
}

export function hasPendingPracticeSync(sessionId: string): boolean {
  const db = getDatabase();
  const res = db.execute(
    `SELECT 1 FROM practice_events
     WHERE session_id = ? AND (sync_status IS NULL OR sync_status != 'synced')
     LIMIT 1`,
    [sessionId],
  );
  return Boolean(res.rows && res.rows.length > 0);
}
