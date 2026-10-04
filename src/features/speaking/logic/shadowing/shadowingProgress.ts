import {listDownloadedLessonSummaries} from '@features/lesson/player';

import {getDatabase} from '@core/db/database';
import type {SpeakingAttemptRecord, SpeakingMode} from '@core/db/types';

import {
  orderShadowingSentences,
  type ShadowingSentence,
} from './shadowingLessons';

const SHADOWING_MODE: SpeakingMode = 'shadowing';

export type ShadowingLessonStatusChip = 'Chưa luyện' | 'Đang dở' | 'Xong';

export type ShadowingLessonProgressSummary = {
  lessonId: string;
  titleVi: string;
  sentenceCount: number;
  estimatedMinutes: number;
  practicedSentenceCount: number;
  reviewSentenceCount: number;
  statusChip: ShadowingLessonStatusChip;
  /** 0-based index into ordered sentences; session start position (BR-008). */
  resumeSentenceIndex: number;
  /** 1-based display index for "Tiếp tục" / progress (câu x/n). */
  resumeSentenceNumber: number;
  lastPracticedAt: string | null;
};

export type ShadowingEntryTarget =
  | {screen: 'ShadowingLessonPicker'}
  | {
      screen: 'ShadowingSession';
      lessonId: string;
      sentenceIndex: number;
    };

type AttemptRow = {
  id: string;
  sentence_id: string;
  practiced_at: string;
  check_full_sentence: number;
  check_key_words: number;
  check_rhythm: number;
};

function mapAttemptRow(
  row: AttemptRow,
  lessonId: string,
): SpeakingAttemptRecord {
  return {
    id: row.id,
    lessonId,
    sentenceId: row.sentence_id,
    mode: SHADOWING_MODE,
    practicedAt: row.practiced_at,
    checkFullSentence: Boolean(row.check_full_sentence),
    checkKeyWords: Boolean(row.check_key_words),
    checkRhythm: Boolean(row.check_rhythm),
    durationMs: 0,
    recordingId: null,
    revision: 0,
    updatedAt: row.practiced_at,
  };
}

/** Newest row per sentence: `practiced_at` desc, then `id` desc (sync replay stability). */
function compareAttemptsByRecency(
  a: SpeakingAttemptRecord,
  b: SpeakingAttemptRecord,
): number {
  if (a.practicedAt !== b.practicedAt) {
    return a.practicedAt > b.practicedAt ? 1 : -1;
  }
  return a.id > b.id ? 1 : a.id < b.id ? -1 : 0;
}

function listShadowingAttemptsForLesson(
  lessonId: string,
): SpeakingAttemptRecord[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT id, sentence_id, practiced_at, check_full_sentence, check_key_words, check_rhythm
     FROM speaking_attempts
     WHERE mode = ? AND lesson_id = ?
     ORDER BY practiced_at DESC, id DESC;`,
    [SHADOWING_MODE, lessonId],
  );
  const items: SpeakingAttemptRecord[] = [];
  const rows = result.rows;
  if (!rows) {
    return items;
  }
  for (let i = 0; i < rows.length; i += 1) {
    items.push(mapAttemptRow(rows.item(i) as AttemptRow, lessonId));
  }
  return items;
}

function canonicalLatestAttemptsBySentence(
  attempts: readonly SpeakingAttemptRecord[],
  sentenceIds: ReadonlySet<string>,
): Map<string, SpeakingAttemptRecord> {
  const attemptBySentence = new Map<string, SpeakingAttemptRecord>();
  for (const attempt of attempts) {
    if (!sentenceIds.has(attempt.sentenceId)) {
      continue;
    }
    const existing = attemptBySentence.get(attempt.sentenceId);
    if (!existing || compareAttemptsByRecency(attempt, existing) > 0) {
      attemptBySentence.set(attempt.sentenceId, attempt);
    }
  }
  return attemptBySentence;
}

function pickMostRecentLessonAttempt(
  attempts: readonly SpeakingAttemptRecord[],
  sentencePositionById: ReadonlyMap<string, number>,
): SpeakingAttemptRecord {
  return attempts.reduce((best, current) => {
    if (current.practicedAt !== best.practicedAt) {
      return current.practicedAt > best.practicedAt ? current : best;
    }
    const posCurrent = sentencePositionById.get(current.sentenceId) ?? -1;
    const posBest = sentencePositionById.get(best.sentenceId) ?? -1;
    if (posCurrent !== posBest) {
      return posCurrent > posBest ? current : best;
    }
    return compareAttemptsByRecency(current, best) > 0 ? current : best;
  });
}

function isAttemptFailed(attempt: SpeakingAttemptRecord): boolean {
  return (
    !attempt.checkFullSentence || !attempt.checkKeyWords || !attempt.checkRhythm
  );
}

/** BR-008: derive status and resume from current sentences and their attempts. */
export function computeShadowingLessonProgress(
  lessonId: string,
  titleVi: string,
  sentences: readonly ShadowingSentence[],
  attempts: readonly SpeakingAttemptRecord[],
  estimatedMinutes: number,
): ShadowingLessonProgressSummary | null {
  if (sentences.length === 0) {
    return null;
  }

  const sentenceIds = new Set(sentences.map(s => s.id));
  const sentencePositionById = new Map(
    sentences.map(s => [s.id, s.position] as const),
  );
  const attemptBySentence = canonicalLatestAttemptsBySentence(
    attempts,
    sentenceIds,
  );
  const canonicalAttempts = [...attemptBySentence.values()];

  const practicedSentenceCount = attemptBySentence.size;
  let reviewSentenceCount = 0;
  for (const attempt of attemptBySentence.values()) {
    if (isAttemptFailed(attempt)) {
      reviewSentenceCount += 1;
    }
  }

  let statusChip: ShadowingLessonStatusChip = 'Chưa luyện';
  let resumeSentenceIndex = 0;

  if (practicedSentenceCount > 0) {
    const lastSentence = sentences[sentences.length - 1]!;
    const mostRecent = pickMostRecentLessonAttempt(
      canonicalAttempts,
      sentencePositionById,
    );
    const mostRecentIndex = sentences.findIndex(
      s => s.id === mostRecent.sentenceId,
    );

    if (mostRecent.sentenceId === lastSentence.id) {
      statusChip = 'Xong';
      resumeSentenceIndex = 0;
    } else {
      statusChip = 'Đang dở';
      resumeSentenceIndex =
        mostRecentIndex >= 0
          ? Math.min(mostRecentIndex + 1, sentences.length - 1)
          : 0;
    }
  }

  const lastPracticedAt =
    practicedSentenceCount > 0
      ? pickMostRecentLessonAttempt(canonicalAttempts, sentencePositionById)
          .practicedAt
      : null;

  return {
    lessonId,
    titleVi,
    sentenceCount: sentences.length,
    estimatedMinutes,
    practicedSentenceCount,
    reviewSentenceCount,
    statusChip,
    resumeSentenceIndex,
    resumeSentenceNumber: resumeSentenceIndex + 1,
    lastPracticedAt,
  };
}

export function summarizeShadowingLessonProgress(
  lessonId: string,
): ShadowingLessonProgressSummary | null {
  const lesson = listDownloadedLessonSummaries().find(
    entry => entry.lessonId === lessonId,
  );
  if (!lesson) {
    return null;
  }
  const sentences = orderShadowingSentences(lesson.snapshot.sentences);
  if (sentences.length === 0) {
    return null;
  }
  const attempts = listShadowingAttemptsForLesson(lessonId);
  return computeShadowingLessonProgress(
    lessonId,
    lesson.title,
    sentences,
    attempts,
    lesson.estimatedDurationMinutes ??
      Math.max(1, Math.ceil(sentences.length / 3)),
  );
}

export function listShadowingLessonProgressSummaries(): ShadowingLessonProgressSummary[] {
  const summaries: ShadowingLessonProgressSummary[] = [];
  for (const lesson of listDownloadedLessonSummaries()) {
    const summary = summarizeShadowingLessonProgress(lesson.lessonId);
    if (summary) {
      summaries.push(summary);
    }
  }
  return summaries;
}

export function findMostRecentInProgressShadowingLesson(): ShadowingLessonProgressSummary | null {
  const inProgress = listShadowingLessonProgressSummaries().filter(
    s => s.statusChip === 'Đang dở',
  );
  if (inProgress.length === 0) {
    return null;
  }
  return inProgress.reduce((latest, current) => {
    if (!latest.lastPracticedAt || !current.lastPracticedAt) {
      return current;
    }
    if (current.lastPracticedAt !== latest.lastPracticedAt) {
      return current.lastPracticedAt > latest.lastPracticedAt
        ? current
        : latest;
    }
    return current.lessonId > latest.lessonId ? current : latest;
  });
}

/** A-019: Hôm nay opens in-progress session or the lesson picker. */
export function resolveShadowingEntry(): ShadowingEntryTarget {
  const inProgress = findMostRecentInProgressShadowingLesson();
  if (inProgress) {
    return {
      screen: 'ShadowingSession',
      lessonId: inProgress.lessonId,
      sentenceIndex: inProgress.resumeSentenceIndex,
    };
  }
  return {screen: 'ShadowingLessonPicker'};
}

/** BR-008 invariant helper: no attempts ⇒ no in-progress resume display. */
export function lessonHasShadowingAttempts(
  summary: ShadowingLessonProgressSummary,
): boolean {
  return summary.practicedSentenceCount > 0;
}
