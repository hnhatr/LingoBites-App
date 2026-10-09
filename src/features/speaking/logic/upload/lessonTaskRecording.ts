import {getDatabase, withTransaction} from '@core/db/database';
import type {EvaluationTarget} from '@core/schemas/evaluation';
import type {LessonSupportLevel} from '@core/schemas/sync';
import {createTaskAnswer} from '@core/sync/taskAnswers';

import {requestRecordingUploadDrain} from './recordingUploadQueue';

export type QueueLessonTaskRecordingInput = {
  /** Client recording id (`recording_client_id` of the attempt). */
  recordingId: string;
  attemptId: string;
  ownerUserId: string | null;
  target: EvaluationTarget;
  taskId: string;
  supportLevel: LessonSupportLevel;
  filePath: string;
  durationMs: number;
  now?: string;
};

/**
 * PR 14 (decision H2): hand a spoken step-5 or summative answer to the
 * upload queue. The recording row (`mode = lesson_task`, `activity_id` =
 * the attempt) and the answer waiting for its result are written together;
 * the queue sends it under the grading consent and deletes the file once
 * the Server has it.
 */
export function queueLessonTaskRecording(
  input: QueueLessonTaskRecordingInput,
): void {
  const now = input.now ?? new Date().toISOString();
  const db = getDatabase();
  withTransaction(db, () => {
    db.execute(
      `INSERT INTO speaking_recordings (
        id, activity_id, lesson_id, mode, file_path, duration_ms, created_at,
        sentence_id, owner_user_id, upload_state, upload_attempts
      ) VALUES (?, ?, ?, 'lesson_task', ?, ?, ?, NULL, ?, 'pending', 0);`,
      [
        input.recordingId,
        input.attemptId,
        'lesson_id' in input.target ? input.target.lesson_id : null,
        input.filePath,
        Math.round(input.durationMs),
        now,
        input.ownerUserId,
      ],
    );
    createTaskAnswer({
      attemptId: input.attemptId,
      ownerUserId: input.ownerUserId,
      target: input.target,
      taskId: input.taskId,
      source: 'speech',
      substitute: false,
      supportLevel: input.supportLevel,
      recordingId: input.recordingId,
      state: 'waiting_upload',
      now,
    });
  });
  requestRecordingUploadDrain();
}
