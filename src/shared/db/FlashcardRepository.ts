import {createRequestId} from '../api/requestId';
import type {UpcomingReviewReminder} from '@modules/engagement';
import {getOrCreateAnonymousUserId} from './anonymousUserId';
import {getDatabase, withTransaction} from './database';
import {enqueueSyncOutboxEvent} from './SyncOutboxRepository';
import {REVIEW_EVENT_SCHEMA_VERSION} from './types';
import {
  DEFAULT_REVIEW_INTERVAL_DAYS,
  calculateNextReviewState,
} from '@modules/review';
import type {
  FlashcardRecord,
  GetDueFlashcardsOptions,
  ListFlashcardsOptions,
  RecordFlashcardRatingInput,
  RecordFlashcardRatingResult,
  SaveFlashcardInput,
  SaveFlashcardResult,
} from './types';

type FlashcardRow = {
  id: string;
  lesson_id: string;
  vocabulary_id: string;
  word: string;
  phrase_from_text: string | null;
  word_type: string | null;
  meaning_vi: string;
  pronunciation_guide_vi: string | null;
  ipa: string | null;
  cefr_level: string | null;
  source_sentence: string | null;
  example: string | null;
  example_translation: string | null;
  is_saved: number;
  created_at: string;
  updated_at: string;
  revision?: number;
  tombstone?: number;
};

type ReviewScheduleRow = {
  card_id: string;
  lesson_id: string;
  interval_days: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapFlashcardRow(row: FlashcardRow): FlashcardRecord {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    vocabularyId: row.vocabulary_id,
    word: row.word,
    phraseFromText: row.phrase_from_text,
    wordType: row.word_type,
    meaningVi: row.meaning_vi,
    pronunciationGuideVi: row.pronunciation_guide_vi,
    ipa: row.ipa,
    cefrLevel: row.cefr_level,
    sourceSentence: row.source_sentence,
    example: row.example,
    exampleTranslation: row.example_translation,
    isSaved: row.is_saved === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision || 0,
    tombstone: Boolean(row.tombstone),
  };
}

function firstRow<T>(result: {
  rows?: {item: (index: number) => unknown};
}): T | null {
  return (result.rows?.item(0) as T | undefined) ?? null;
}

export function saveFlashcard(input: SaveFlashcardInput): SaveFlashcardResult {
  try {
    const db = getDatabase();
    const now = input.now ?? new Date().toISOString();
    const existing = firstRow<FlashcardRow>(
      db.execute(
        'SELECT * FROM flashcards WHERE lesson_id = ? AND vocabulary_id = ? LIMIT 1;',
        [input.lessonId, input.vocabulary.id],
      ),
    );

    if (existing) {
      db.execute(
        'UPDATE flashcards SET is_saved = 1, updated_at = ? WHERE id = ?;',
        [now, existing.id],
      );
      return {ok: true, flashcardId: existing.id, duplicate: true};
    }

    const flashcardId = createRequestId();
    db.execute(
      `INSERT INTO flashcards (
        id, lesson_id, vocabulary_id, word, phrase_from_text, word_type,
        meaning_vi, pronunciation_guide_vi, ipa, cefr_level, source_sentence,
        example, example_translation, is_saved, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        flashcardId,
        input.lessonId,
        input.vocabulary.id,
        input.vocabulary.word,
        input.vocabulary.phrase_from_text ?? input.vocabulary.phraseFromText ?? null,
        input.vocabulary.word_type ?? input.vocabulary.wordType ?? null,
        input.vocabulary.meaning_vi ?? input.vocabulary.meaningVi ?? '',
        input.vocabulary.pronunciation_guide_vi ?? input.vocabulary.pronunciationGuideVi ?? null,
        input.vocabulary.ipa ?? null,
        input.vocabulary.cefr_level ?? input.vocabulary.cefrLevel ?? null,
        input.vocabulary.source_sentence ?? input.vocabulary.sourceSentence ?? null,
        input.vocabulary.example ?? null,
        input.vocabulary.example_translation ?? input.vocabulary.exampleTranslation ?? null,
        1,
        now,
        now,
      ],
    );
    db.execute(
      `INSERT INTO review_schedule (
        card_id, lesson_id, interval_days, next_review_at, last_reviewed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        flashcardId,
        input.lessonId,
        DEFAULT_REVIEW_INTERVAL_DAYS,
        now,
        null,
        now,
        now,
      ],
    );

    return {ok: true, flashcardId, duplicate: false};
  } catch {
    return {
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
    };
  }
}

export function listFlashcards({
  lessonId,
  includeUnsaved = false,
}: ListFlashcardsOptions = {}): FlashcardRecord[] {
  const db = getDatabase();
  const clauses: string[] = [];
  const params: string[] = [];

  if (!includeUnsaved) {
    clauses.push('is_saved = 1');
  }
  if (lessonId) {
    clauses.push('lesson_id = ?');
    params.push(lessonId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = db.execute(
    `SELECT * FROM flashcards ${where} ORDER BY datetime(created_at) ASC;`,
    params,
  );
  const rows = result.rows;
  const items: FlashcardRecord[] = [];

  if (!rows) {
    return items;
  }

  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapFlashcardRow(rows.item(index) as FlashcardRow));
  }

  return items;
}

export function unsaveFlashcard(
  flashcardId: string,
  updatedAt = new Date().toISOString(),
): boolean {
  const db = getDatabase();
  const result = db.execute(
    'UPDATE flashcards SET is_saved = 0, updated_at = ? WHERE id = ?;',
    [updatedAt, flashcardId],
  );
  return (result.rowsAffected ?? 0) > 0;
}

export function getDueFlashcards({
  today = new Date().toISOString(),
  limit,
}: GetDueFlashcardsOptions = {}): FlashcardRecord[] {
  const end = new Date(today);
  end.setUTCHours(23, 59, 59, 999);

  const params: Array<string | number> = [end.toISOString()];
  const limitClause = limit && limit > 0 ? ' LIMIT ?' : '';
  if (limit && limit > 0) {
    params.push(limit);
  }

  const db = getDatabase();
  const result = db.execute(
    // SETE-253: cards without a Vietnamese translation can never be answered
    // (the back face would repeat the English prompt), so they are excluded
    // from the due queue at the source rather than rendered degenerately.
    `SELECT flashcards.* FROM flashcards
      INNER JOIN review_schedule ON review_schedule.card_id = flashcards.id
      WHERE flashcards.is_saved = 1
        AND TRIM(flashcards.meaning_vi) != ''
        AND review_schedule.next_review_at <= ?
      ORDER BY datetime(review_schedule.next_review_at) ASC${limitClause};`,
    params,
  );
  const rows = result.rows;
  const due: FlashcardRecord[] = [];

  if (!rows) {
    return due;
  }

  for (let index = 0; index < rows.length; index += 1) {
    due.push(mapFlashcardRow(rows.item(index) as FlashcardRow));
  }

  return due;
}

/**
 * Records a two-rating review outcome on a schedule row.
 *
 * The MVP contract (SETE-92) is a fixed-interval two-rating model:
 * `remembered` advances the card to the next fixed bucket and `forgot`
 * resets it to a 1-day relearn. The review write and its outbox row are
 * committed atomically (ADR-2): a crash mid-rating can leave a recorded
 * session but never a session without a matching outbox event waiting to sync.
 */
export function recordFlashcardRating(
  input: RecordFlashcardRatingInput,
): RecordFlashcardRatingResult {
  try {
    const db = getDatabase();
    const schedule = firstRow<ReviewScheduleRow>(
      db.execute('SELECT * FROM review_schedule WHERE card_id = ? LIMIT 1;', [
        input.flashcardId,
      ]),
    );

    if (!schedule) {
      return {
        ok: false,
        errorCode: 'FLASHCARD_NOT_FOUND',
      };
    }

    const reviewedAt = input.reviewedAt ?? new Date().toISOString();

    const outcome = withTransaction(db, () => {
      const next = calculateNextReviewState({
        rating: input.rating,
        currentIntervalDays: schedule.interval_days,
        reviewedAt,
      });
      const sessionId = createRequestId();

      db.execute(
        `INSERT INTO review_sessions (
          id, card_id, lesson_id, rating, reviewed_at, interval_days,
          next_review_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          sessionId,
          input.flashcardId,
          schedule.lesson_id,
          input.rating,
          reviewedAt,
          next.intervalDays,
          next.nextReviewAt,
          reviewedAt,
        ],
      );
      db.execute(
        `UPDATE review_schedule
          SET interval_days = ?, next_review_at = ?, last_reviewed_at = ?, updated_at = ?
          WHERE card_id = ?;`,
        [
          next.intervalDays,
          next.nextReviewAt,
          reviewedAt,
          reviewedAt,
          input.flashcardId,
        ],
      );

      getOrCreateAnonymousUserId();
      enqueueSyncOutboxEvent({
        id: sessionId,
        entityId: input.flashcardId,
        createdAt: reviewedAt,
        payload: {
          schema_version: REVIEW_EVENT_SCHEMA_VERSION,
          card_id: input.flashcardId,
          lesson_id: schedule.lesson_id,
          rating: input.rating,
          reviewed_at: reviewedAt,
          interval_days: next.intervalDays,
          next_review_at: next.nextReviewAt,
        },
      });

      return next;
    });

    return {
      ok: true,
      intervalDays: outcome.intervalDays,
      nextReviewAt: outcome.nextReviewAt,
    };
  } catch {
    return {
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
    };
  }
}

/**
 * Current due instant (`next_review_at`) of a card, or null when the card has
 * no schedule row. Engagement code reads this *before* rating the card so it
 * can tell whether the review happened on time (see `isOnTimeReview`).
 */
export function getCardDueAt(cardId: string): string | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT next_review_at FROM review_schedule WHERE card_id = ? LIMIT 1;',
    [cardId],
  );
  const row = result.rows?.item(0) as {next_review_at: string} | undefined;
  return row?.next_review_at ?? null;
}

type UpcomingReminderRow = {
  card_id: string;
  word: string;
  next_review_at: string;
};

/**
 * Cards whose next review is strictly in the future, with the word to show in
 * the reminder. This is the "desired" reminder set the OS notification state is
 * reconciled against (REQ-10). Cards no longer saved are excluded.
 */
export function listUpcomingReviewReminders(
  now = new Date().toISOString(),
): UpcomingReviewReminder[] {
  const db = getDatabase();
  const result = db.execute(
    `SELECT review_schedule.card_id, flashcards.word, review_schedule.next_review_at
      FROM review_schedule
      INNER JOIN flashcards ON flashcards.id = review_schedule.card_id
      WHERE review_schedule.next_review_at > ? AND flashcards.is_saved = 1
      ORDER BY datetime(review_schedule.next_review_at) ASC;`,
    [now],
  );
  const rows = result.rows;
  const items: UpcomingReviewReminder[] = [];
  if (!rows) {
    return items;
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows.item(index) as UpcomingReminderRow;
    items.push({
      cardId: row.card_id,
      word: row.word,
      dueAt: row.next_review_at,
    });
  }
  return items;
}
