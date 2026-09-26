import {validFullOutput} from '@shared/fixtures';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {getDatabase, resetDatabaseForTests} from '../database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '../constants';
import {
  getDueFlashcards,
  listFlashcards,
  recordFlashcardRating,
  saveFlashcard,
  unsaveFlashcard,
} from '../FlashcardRepository';
import {
  listPendingSyncEvents,
  markSyncEventsSynced,
} from '../SyncOutboxRepository';
import type {ReviewEventPayload} from '../types';

function saveFixtureLesson(): string {
  return 'lesson-1';
}

function readScheduleRow(cardId: string) {
  const result = getDatabase().execute(
    'SELECT * FROM review_schedule WHERE card_id = ? LIMIT 1;',
    [cardId],
  );
  return (
    (result.rows?.item(0) as
      | {
          card_id: string;
          interval_days: number;
          next_review_at: string;
          updated_at: string;
        }
      | undefined) ?? null
  );
}

describe('FlashcardRepository', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('saves flashcard vocabulary with a lesson reference and lists it', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    const cards = listFlashcards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: saved.flashcardId,
      lessonId,
      vocabularyId: 'v1',
      word: 'offer',
      meaningVi: 'cung cấp, đề nghị',
      isSaved: true,
    });
  });

  it('filters flashcards by lesson id', () => {
    const firstLessonId = saveFixtureLesson();
    const secondLessonId = `${firstLessonId}-second`;

    saveFlashcard({
      lessonId: firstLessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    saveFlashcard({
      lessonId: secondLessonId,
      vocabulary: {
        ...validFullOutput.vocabulary[0],
        id: 'v2',
        word: 'discount',
      },
      now: '2026-08-17T00:01:00.000Z',
    });

    expect(
      listFlashcards({lessonId: firstLessonId}).map(card => card.word),
    ).toEqual(['offer']);
  });

  it('unsaves a flashcard without deleting its review history', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T09:00:00.000Z',
    });

    expect(unsaveFlashcard(saved.flashcardId, '2026-08-17T10:00:00.000Z')).toBe(
      true,
    );
    expect(listFlashcards()).toHaveLength(0);
    expect(listFlashcards({includeUnsaved: true})[0]).toMatchObject({
      id: saved.flashcardId,
      isSaved: false,
    });
  });

  it('records a remembered rating and pushes the card out of today due queue', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    expect(getDueFlashcards({today: '2026-08-17T12:00:00.000Z'})).toHaveLength(
      1,
    );

    const result = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.intervalDays).toBe(3);
    expect(getDueFlashcards({today: '2026-08-17T12:01:00.000Z'})).toHaveLength(
      0,
    );
  });

  it('respects due queue soft cap and carries overflow to later calls', () => {
    const lessonId = saveFixtureLesson();

    for (let index = 0; index < 3; index += 1) {
      saveFlashcard({
        lessonId,
        vocabulary: {
          ...validFullOutput.vocabulary[0],
          id: `v${index}`,
          word: `word-${index}`,
        },
        now: `2026-08-1${index}T00:00:00.000Z`,
      });
    }

    const due = getDueFlashcards({
      today: '2026-08-17T12:00:00.000Z',
      limit: 2,
    });

    expect(due.map(card => card.word)).toEqual(['word-0', 'word-1']);
    expect(getDueFlashcards({today: '2026-08-18T12:00:00.000Z'})).toHaveLength(
      3,
    );
  });

  it('excludes cards without a Vietnamese translation from the due queue (SETE-253)', () => {
    const lessonId = saveFixtureLesson();
    const base = validFullOutput.vocabulary[0];
    const now = '2026-08-17T00:00:00.000Z';

    const results = [
      saveFlashcard({
        lessonId,
        vocabulary: {...base, id: 'v-with', word: 'offer', meaning_vi: 'cung cấp'},
        now,
      }),
      saveFlashcard({
        lessonId,
        vocabulary: {...base, id: 'v-empty', word: 'empty-word', meaning_vi: ''},
        now,
      }),
      saveFlashcard({
        lessonId,
        vocabulary: {
          ...base,
          id: 'v-blank',
          word: 'blank-word',
          meaning_vi: '   ',
        },
        now,
      }),
    ];
    for (const result of results) {
      expect(result.ok).toBe(true);
    }

    // Degenerate front==back cards never appear in the due queue, even though
    // they remain listed in the library.
    expect(
      getDueFlashcards({today: '2026-08-17T12:00:00.000Z'}).map(
        card => card.word,
      ),
    ).toEqual(['offer']);
    expect(listFlashcards()).toHaveLength(3);
  });

  it('forgot rating resets the card to a 1-day relearn', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    const result = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'forgot',
      reviewedAt: '2026-08-18T12:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.intervalDays).toBe(1);

    const row = readScheduleRow(saved.flashcardId);
    expect(row?.interval_days).toBe(1);
    expect(row?.next_review_at).toBe('2026-08-19T12:00:00.000Z');
  });

  it('walks remembered ratings through the fixed interval chain', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    // Fresh rows start at interval 1 and are immediately due.
    const first = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    expect(first.ok && first.intervalDays).toBe(3);

    const second = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-20T12:00:00.000Z',
    });
    expect(second.ok && second.intervalDays).toBe(7);

    const third = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-27T12:00:00.000Z',
    });
    expect(third.ok && third.intervalDays).toBe(14);
  });

  it('enqueues a pending outbox event atomically with each recorded rating', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    const result = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    expect(result.ok).toBe(true);

    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      eventType: 'review',
      entityId: saved.flashcardId,
      attemptCount: 0,
      syncedAt: null,
      createdAt: '2026-08-17T12:00:00.000Z',
    });
    expect(pending[0].payload).toMatchObject({
      schema_version: 1,
      card_id: saved.flashcardId,
      lesson_id: lessonId,
      rating: 'remembered',
      reviewed_at: '2026-08-17T12:00:00.000Z',
      interval_days: 3,
    });
    expect(
      (pending[0].payload as ReviewEventPayload).next_review_at,
    ).toBe(result.ok ? result.nextReviewAt : '');
  });

  it('does not enqueue an outbox event when the rating fails', () => {
    const result = recordFlashcardRating({
      flashcardId: 'missing-card',
      rating: 'forgot',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    expect(listPendingSyncEvents()).toHaveLength(0);
  });

  it('marks an outbox event synced and removes it from the pending queue', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    if (!saved.ok) {
      return;
    }
    recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });

    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);

    markSyncEventsSynced(
      pending.map(event => event.id),
      '2026-08-17T13:00:00.000Z',
    );
    expect(listPendingSyncEvents()).toHaveLength(0);
  });

  it('duplicate save is idempotent: no extra rows and schedule is not reset', () => {
    const lessonId = saveFixtureLesson();
    const vocabulary = validFullOutput.vocabulary[0];

    const first = saveFlashcard({
      lessonId,
      vocabulary,
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    // Advance the schedule so we can tell if it gets reset.
    recordFlashcardRating({
      flashcardId: first.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    const rowAfterRating = readScheduleRow(first.flashcardId);
    expect(rowAfterRating?.interval_days).toBe(3);

    // Save the same vocabulary again.
    const second = saveFlashcard({
      lessonId,
      vocabulary,
      now: '2026-08-17T13:00:00.000Z',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.duplicate).toBe(true);
    expect(second.flashcardId).toBe(first.flashcardId);

    // Exactly one flashcard row must exist.
    expect(listFlashcards()).toHaveLength(1);

    // Schedule must not have been reset by the duplicate save.
    const rowAfterDuplicate = readScheduleRow(first.flashcardId);
    expect(rowAfterDuplicate?.interval_days).toBe(3);
    expect(rowAfterDuplicate?.interval_days).toBe(
      rowAfterRating?.interval_days,
    );
  });

  it('returns FLASHCARD_NOT_FOUND when rating a nonexistent card', () => {
    const result = recordFlashcardRating({
      flashcardId: 'nonexistent-card-id',
      rating: 'forgot',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errorCode).toBe('FLASHCARD_NOT_FOUND');
  });

  it('forgot resets the schedule row interval_days to 1 in the database', () => {
    const lessonId = saveFixtureLesson();
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    // Mature the card so interval_days > 1 before the forgot.
    recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-20T12:00:00.000Z',
    });
    const rowBeforeForgot = readScheduleRow(saved.flashcardId);
    expect((rowBeforeForgot?.interval_days ?? 0) > 1).toBe(true);

    // Now forget.
    recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'forgot',
      reviewedAt: '2026-08-27T12:00:00.000Z',
    });

    const row = readScheduleRow(saved.flashcardId);
    expect(row?.interval_days).toBe(1);
    expect(row?.next_review_at).toBe('2026-08-28T12:00:00.000Z');
  });
});
