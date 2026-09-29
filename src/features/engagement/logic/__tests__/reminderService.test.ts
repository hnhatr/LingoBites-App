import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@core/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {saveFlashcard, recordFlashcardRating} from '@features/review';
import {validFullOutput} from '@core/fixtures';
import {
  configureReminderScheduler,
  noopReminderScheduler,
  reconcileReminders,
  syncReviewReminders,
} from '../reminderService';
import type {PendingReminder} from '../reminderPolicy';

const NOW = '2026-09-01T00:00:00.000Z';

function createFakeScheduler() {
  const pending = new Map<string, string>();
  const calls = {
    scheduled: [] as Array<{cardId: string; word: string; dueAt: string}>,
    cancelled: [] as string[],
  };
  return {
    scheduler: {
      listPending: () => {
        const items: PendingReminder[] = [];
        for (const [cardId, dueAt] of pending.entries()) {
          items.push({cardId, dueAt});
        }
        return items;
      },
      schedule: (params: {cardId: string; word: string; dueAt: string}) => {
        pending.set(params.cardId, params.dueAt);
        calls.scheduled.push(params);
      },
      cancel: (cardId: string) => {
        pending.delete(cardId);
        calls.cancelled.push(cardId);
      },
    },
    pending,
    calls,
  };
}

/** Saves one flashcard whose next review can then be pushed into the future. */
function seedFlashcard(): string {
  const saveResult = saveFlashcard({
    lessonId: 'lesson-1',
    vocabulary: validFullOutput.vocabulary[0],
    now: NOW,
  });
  if (!saveResult.ok) {
    throw new Error('failed to seed flashcard');
  }
  return saveResult.flashcardId;
}

describe('reminderService', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    configureReminderScheduler(noopReminderScheduler);
  });

  it('schedules a reminder at the card due time (REQ-10)', () => {
    const cardId = seedFlashcard();
    recordFlashcardRating({
      flashcardId: cardId,
      rating: 'remembered',
      reviewedAt: '2026-09-02T08:00:00.000Z',
    });
    const fake = createFakeScheduler();

    const result = syncReviewReminders(
      fake.scheduler,
      '2026-09-02T09:00:00.000Z',
    );

    expect(result).toEqual({scheduled: 1, cancelled: 0});
    expect(fake.calls.scheduled).toHaveLength(1);
    expect(fake.calls.scheduled[0]).toMatchObject({
      cardId,
      dueAt: '2026-09-05T08:00:00.000Z',
    });
    expect(fake.calls.scheduled[0].word.length).toBeGreaterThan(0);
  });

  it('is idempotent across app restarts when OS state already matches', () => {
    const cardId = seedFlashcard();
    recordFlashcardRating({
      flashcardId: cardId,
      rating: 'remembered',
      reviewedAt: '2026-09-02T08:00:00.000Z',
    });
    const fake = createFakeScheduler();

    syncReviewReminders(fake.scheduler, '2026-09-02T09:00:00.000Z');
    // Second launch: OS still holds the same pending notification.
    const again = syncReviewReminders(
      fake.scheduler,
      '2026-09-02T10:00:00.000Z',
    );

    expect(again).toEqual({scheduled: 0, cancelled: 0});
    expect(fake.calls.scheduled).toHaveLength(1);
    expect(fake.calls.cancelled).toHaveLength(0);
  });

  it('reschedules when the card due time changes after a review', () => {
    const cardId = seedFlashcard();
    recordFlashcardRating({
      flashcardId: cardId,
      rating: 'remembered',
      reviewedAt: '2026-09-02T08:00:00.000Z',
    });
    const fake = createFakeScheduler();
    syncReviewReminders(fake.scheduler, '2026-09-02T09:00:00.000Z');

    // Learner reviews the card again two days later — the fixed scheduler
    // advances the card to the next bucket, moving its due time.
    recordFlashcardRating({
      flashcardId: cardId,
      rating: 'remembered',
      reviewedAt: '2026-09-03T09:00:00.000Z',
    });
    const result = syncReviewReminders(
      fake.scheduler,
      '2026-09-03T10:00:00.000Z',
    );

    expect(result).toEqual({scheduled: 1, cancelled: 1});
    expect(fake.calls.cancelled).toEqual([cardId]);
    expect(fake.calls.scheduled).toHaveLength(2);
    expect(fake.calls.scheduled[1].dueAt).toBe('2026-09-10T09:00:00.000Z');
  });

  it('cancels stale notifications for cards no longer due in the future', () => {
    const cardId = seedFlashcard();
    recordFlashcardRating({
      flashcardId: cardId,
      rating: 'forgot',
      reviewedAt: '2026-09-02T08:00:00.000Z',
    });
    const fake = createFakeScheduler();
    syncReviewReminders(fake.scheduler, '2026-09-02T09:00:00.000Z');

    // App reopened after the due instant passed without a new future due.
    const result = syncReviewReminders(
      fake.scheduler,
      '2026-09-05T00:00:00.000Z',
    );
    expect(result).toEqual({scheduled: 0, cancelled: 1});
    expect(fake.calls.cancelled).toEqual([cardId]);
  });

  it('noop scheduler never throws and schedules nothing', () => {
    const result = syncReviewReminders(noopReminderScheduler, NOW);
    expect(result).toEqual({scheduled: 0, cancelled: 0});
  });

  it('reconciles through the installed scheduler adapter', () => {
    const cardId = seedFlashcard();
    recordFlashcardRating({
      flashcardId: cardId,
      rating: 'remembered',
      reviewedAt: '2026-09-02T08:00:00.000Z',
    });
    const fake = createFakeScheduler();
    configureReminderScheduler(fake.scheduler);

    const result = reconcileReminders('2026-09-02T09:00:00.000Z');
    expect(result).toEqual({scheduled: 1, cancelled: 0});
    expect(fake.pending.get(cardId)).toBe('2026-09-05T08:00:00.000Z');
  });
});
