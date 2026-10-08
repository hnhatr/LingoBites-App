import type {UpcomingReviewReminder} from '@features/review/logic/contracts';
import {
  calculateNextReviewState,
  DEFAULT_REVIEW_INTERVAL_DAYS,
} from '@features/review/logic/reviewPolicy';

import {createRequestId} from '@core/api/requestId';
import {getOrCreateAnonymousUserId} from '@core/db/anonymousUserId';
import {getDatabase, withSavepoint, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {
  FlashcardRecord,
  FlashcardSource,
  GetDueFlashcardsOptions,
  ListFlashcardsOptions,
  RecordFlashcardRatingInput,
  RecordFlashcardRatingResult,
  SaveFlashcardInput,
  SaveFlashcardResult,
} from '@core/db/types';
import {REVIEW_EVENT_SCHEMA_VERSION} from '@core/db/types';
import {vocabularyItemKey} from '@core/learning';

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
  item_key?: string | null;
  item_id?: string | null;
  kind?: string | null;
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
    itemKey: row.item_key ?? null,
    itemId: row.item_id ?? null,
    kind: row.kind ?? null,
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

/**
 * Saves a learning item as a flashcard. One card per item code across lessons
 * (decision G3): an item already saved from another lesson reuses that card,
 * keeps its review schedule and just gains this lesson as a source. Lookup and
 * write share one savepoint (so it also works inside a caller's transaction),
 * and `idx_flashcards_item_key_live` rejects a second live card with the same
 * code at the database level.
 */
export function saveFlashcard(input: SaveFlashcardInput): SaveFlashcardResult {
  try {
    const db = getDatabase();
    const now = input.now ?? new Date().toISOString();
    const itemKey =
      input.item?.itemKey ?? vocabularyItemKey(input.vocabulary.word);
    if (!itemKey) {
      return {ok: false, errorCode: 'INVALID_ITEM'};
    }
    const itemId = input.item?.itemId ?? null;
    const kind = input.item?.kind ?? itemKey.slice(0, itemKey.indexOf(':'));
    const sourceSentence =
      input.vocabulary.source_sentence ??
      input.vocabulary.sourceSentence ??
      null;

    const addSource = (cardId: string) => {
      db.execute(
        `INSERT OR IGNORE INTO flashcard_sources (
          card_id, lesson_id, source_sentence, created_at
        ) VALUES (?, ?, ?, ?);`,
        [cardId, input.lessonId, sourceSentence, now],
      );
    };

    return withSavepoint(db, (): SaveFlashcardResult => {
      const existing = firstRow<FlashcardRow>(
        db.execute(
          `SELECT * FROM flashcards
            WHERE item_key = ? AND COALESCE(tombstone, 0) = 0 LIMIT 1;`,
          [itemKey],
        ),
      );

      if (existing) {
        db.execute(
          `UPDATE flashcards
              SET is_saved = 1, updated_at = ?, item_id = COALESCE(item_id, ?)
            WHERE id = ?;`,
          [now, itemId, existing.id],
        );
        addSource(existing.id);
        return {ok: true, flashcardId: existing.id, duplicate: true};
      }

      const flashcardId = createRequestId();
      db.execute(
        `INSERT INTO flashcards (
          id, lesson_id, vocabulary_id, word, phrase_from_text, word_type,
          meaning_vi, pronunciation_guide_vi, ipa, cefr_level, source_sentence,
          example, example_translation, is_saved, created_at, updated_at,
          item_key, item_id, kind
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          flashcardId,
          input.lessonId,
          input.vocabulary.id,
          input.vocabulary.word,
          input.vocabulary.phrase_from_text ??
            input.vocabulary.phraseFromText ??
            null,
          input.vocabulary.word_type ?? input.vocabulary.wordType ?? null,
          input.vocabulary.meaning_vi ?? input.vocabulary.meaningVi ?? '',
          input.vocabulary.pronunciation_guide_vi ??
            input.vocabulary.pronunciationGuideVi ??
            null,
          input.vocabulary.ipa ?? null,
          input.vocabulary.cefr_level ?? input.vocabulary.cefrLevel ?? null,
          sourceSentence,
          input.vocabulary.example ?? null,
          input.vocabulary.example_translation ??
            input.vocabulary.exampleTranslation ??
            null,
          1,
          now,
          now,
          itemKey,
          itemId,
          kind,
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
      addSource(flashcardId);

      return {ok: true, flashcardId, duplicate: false};
    });
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
    // A card saved from another lesson still belongs to this one when this
    // lesson is one of its sources (schema v5).
    clauses.push(
      `(id IN (SELECT card_id FROM flashcard_sources WHERE lesson_id = ?)
        OR (lesson_id = ? AND NOT EXISTS (
          SELECT 1 FROM flashcard_sources s WHERE s.card_id = flashcards.id)))`,
    );
    params.push(lessonId, lessonId);
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

/**
 * Changes whenever the saved vocabulary does: a card saved, unsaved or edited
 * (`id@updated_at` of every saved card), or a card gaining or losing a source
 * lesson. `count` is the number of saved cards.
 */
export function getSavedFlashcardsSignature(): {
  count: number;
  signature: string;
} {
  const db = getDatabase();
  const cards = db.execute(
    'SELECT id, updated_at FROM flashcards WHERE is_saved = 1;',
  );
  const stamps: string[] = [];
  for (let index = 0; index < (cards.rows?.length ?? 0); index += 1) {
    const row = cards.rows!.item(index) as {id: string; updated_at: string};
    stamps.push(`${row.id}@${row.updated_at}`);
  }
  const sources = db.execute('SELECT COUNT(*) AS n FROM flashcard_sources;');
  const sourceCount = Number(
    (sources.rows?.item(0) as {n?: number} | undefined)?.n ?? 0,
  );
  return {
    count: stamps.length,
    signature: `${stamps.sort().join(',')}#${sourceCount}`,
  };
}

/**
 * Every lesson each card was saved from, oldest first, keyed by card id. A card
 * with no source rows (legacy, or a word with no usable key) is absent: callers
 * fall back to the card's own `lessonId`.
 */
export function listFlashcardSources(): Map<string, FlashcardSource[]> {
  const db = getDatabase();
  const result = db.execute(
    `SELECT card_id, lesson_id, source_sentence, created_at
       FROM flashcard_sources
      ORDER BY datetime(created_at) ASC, lesson_id ASC;`,
  );
  const sources = new Map<string, FlashcardSource[]>();
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows!.item(index) as {
      card_id: string;
      lesson_id: string;
      source_sentence: string | null;
      created_at: string;
    };
    const entry: FlashcardSource = {
      lessonId: row.lesson_id,
      sourceSentence: row.source_sentence,
      createdAt: row.created_at,
    };
    const list = sources.get(row.card_id);
    if (list) {
      list.push(entry);
    } else {
      sources.set(row.card_id, [entry]);
    }
  }
  return sources;
}

/**
 * "Remove from this lesson": drops the lesson from the card's sources. The card
 * stays saved while any other lesson still sources it and is only unsaved when
 * the last source goes, so un-saving a word in one lesson never silently
 * removes it from the others. A card with no source rows (legacy) is unsaved
 * outright. The library heart keeps using `unsaveFlashcard` (whole card).
 */
export function removeFlashcardFromLesson(
  cardId: string,
  lessonId: string,
  updatedAt = new Date().toISOString(),
): boolean {
  const db = getDatabase();
  return withSavepoint(db, () => {
    db.execute(
      'DELETE FROM flashcard_sources WHERE card_id = ? AND lesson_id = ?;',
      [cardId, lessonId],
    );
    const remaining = firstRow<{n: number}>(
      db.execute(
        'SELECT COUNT(*) AS n FROM flashcard_sources WHERE card_id = ?;',
        [cardId],
      ),
    );
    if (Number(remaining?.n ?? 0) > 0) {
      return true;
    }
    const result = db.execute(
      'UPDATE flashcards SET is_saved = 0, updated_at = ? WHERE id = ?;',
      [updatedAt, cardId],
    );
    return (result.rowsAffected ?? 0) > 0;
  });
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
