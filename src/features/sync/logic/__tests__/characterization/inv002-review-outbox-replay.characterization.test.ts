import {validFullOutput} from '@core/fixtures';
import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {DB_NAME} from '@core/db/constants';
import {listPendingSyncEvents} from '../../adapters/SyncOutboxRepository';
import {
  recordFlashcardRating,
  saveFlashcard,
} from '@features/review/logic/FlashcardRepository';
import {drainOutboxOnce} from '../../outboxSync';
import {CHARACTERIZATION_INVARIANTS} from '@test/support/characterization';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  mockFetch.mockReset();
});

describe(`${CHARACTERIZATION_INVARIANTS.INV_002} review outbox replay (Jest mock DB/fetch smoke)`, () => {
  it('commits one review outbox event per rating and clears pending on duplicate ack without double POST', async () => {
    const lessonId = 'lesson-char-1';
    const saved = saveFlashcard({
      lessonId,
      vocabulary: validFullOutput.vocabulary[0],
      now: '2026-09-27T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    const rating = recordFlashcardRating({
      flashcardId: saved.flashcardId,
      rating: 'remembered',
      reviewedAt: '2026-09-27T12:00:00.000Z',
    });
    expect(rating.ok).toBe(true);

    const pending = listPendingSyncEvents();
    expect(pending).toHaveLength(1);
    const eventId = pending[0].id;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        request_id: 'r',
        status: 'success',
        accepted: 0,
        duplicates: 1,
        accepted_ids: [],
        duplicate_ids: [eventId],
      }),
    });

    await expect(drainOutboxOnce()).resolves.toEqual({
      status: 'synced',
      syncedIds: [eventId],
    });
    expect(listPendingSyncEvents()).toHaveLength(0);

    await expect(drainOutboxOnce()).resolves.toEqual({status: 'idle'});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
