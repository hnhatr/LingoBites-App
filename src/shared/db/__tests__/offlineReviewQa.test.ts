import {validFullOutput} from '@shared/fixtures';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {getDatabase, resetDatabaseForTests} from '../database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '../constants';
import {
  getCardDueAt,
  getDueFlashcards,
  listFlashcards,
  recordFlashcardRating,
  saveFlashcard,
} from '../FlashcardRepository';

describe('Offline review QA (SETE-101)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('save flashcard -> offline session -> restart keeps schedule and review_sessions', () => {
    // 1. Save a flashcard locally (offline entry point, no network).
    const lessonId = 'lesson-1';

    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    // The new card is immediately due for review today.
    expect(getDueFlashcards({today: '2026-08-17T12:00:00.000Z'})).toHaveLength(
      1,
    );

    // 2. Complete one review session while offline: rate the due card.
    const rating = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-08-17T12:00:00.000Z',
    });
    expect(rating.ok).toBe(true);
    if (!rating.ok) {
      return;
    }
    // Fixed interval: a fresh card reviewed as remembered moves to the 3-day bucket.
    expect(rating.intervalDays).toBe(3);

    // The card leaves today's due queue after the session.
    expect(getDueFlashcards({today: '2026-08-17T23:59:59.000Z'})).toHaveLength(
      0,
    );

    // 3. Simulate an app restart: drop the module DB handle + migration flag,
    //    then reopen the same (file/name-keyed) database.
    resetDatabaseForTests(null);
    const reopened = getDatabase();
    expect(reopened).toBeDefined();

    // 4. Schedule persisted: the card is still saved and due in 3 days.
    expect(listFlashcards()).toHaveLength(1);
    expect(getCardDueAt(saved.flashcardId)).toBe('2026-08-20T12:00:00.000Z');
    expect(getDueFlashcards({today: '2026-08-20T12:00:00.000Z'})).toHaveLength(
      1,
    );

    // 5. The review_sessions row written during the offline session persisted.
    const sessionRows = reopened.execute(
      'SELECT id, card_id, rating, reviewed_at, interval_days, next_review_at FROM review_sessions;',
    ).rows;
    expect(sessionRows?.length).toBe(1);
    const session = sessionRows?.item(0) as
      | {
          id: string;
          card_id: string;
          rating: string;
          reviewed_at: string;
          interval_days: number;
          next_review_at: string;
        }
      | undefined;
    expect(session?.card_id).toBe(saved.flashcardId);
    expect(session?.rating).toBe('remembered');
    expect(session?.reviewed_at).toBe('2026-08-17T12:00:00.000Z');
    expect(session?.interval_days).toBe(3);
    expect(session?.next_review_at).toBe('2026-08-20T12:00:00.000Z');
  });
});
