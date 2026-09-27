import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {enqueueSyncOutboxEvent} from '@shared/db/syncOutboxCore';
import {
  listPendingSyncEvents,
  markSyncEventsFailed,
} from '../adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '../outboxSync';
import {applySyncRecord} from '../pullWorker';
import {SyncCollectionSchema} from '@shared/schemas/sync';
import {getGrammarBookmark} from '@shared/db/GrammarBookmarkRepository';
import {saveContentLesson} from '@shared/db/ContentLessonStateRepository';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Findings Verification (CR-001 to CR-004)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests();
    mockFetch.mockReset();
  });

  describe('CR-001: Event Type & Schema Routing', () => {
    it('validates content_lesson_state is in SyncCollectionSchema', () => {
      expect(
        SyncCollectionSchema.safeParse('content_lesson_state').success,
      ).toBe(true);
    });

    it('drains content_lesson_state as generic sync push event', async () => {
      saveContentLesson({lessonId: 'lesson-cr1', now: '2026-01-01T00:00:00Z'});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          request_id: '11111111-1111-1111-1111-111111111111',
          status: 'success',
          contract_version: 1,
          results: [
            {
              mutation_id: listPendingSyncEvents()[0].id,
              collection: 'content_lesson_state',
              entity_id: 'lesson-cr1',
              status: 'applied',
              revision: 1,
            },
          ],
        }),
      });

      const outcome = await drainOutboxOnce({fetchImpl: mockFetch});
      expect(outcome.status).toBe('synced');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/v1/sync/push');
    });

    it('blocks unknown event types instead of routing them to review endpoint', async () => {
      enqueueSyncOutboxEvent({
        id: 'unk-1',
        eventType: 'unknown_custom_type' as any,
        entityId: 'e1',
        payload: {foo: 'bar'},
      });

      const outcome = await drainOutboxOnce({fetchImpl: mockFetch});
      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.errorCode).toBe('UNKNOWN_EVENT_TYPE');
      }
      expect(mockFetch).not.toHaveBeenCalled();

      const events = listPendingSyncEvents();
      expect(events[0].lastError).toBe('UNKNOWN_EVENT_TYPE');
    });
  });

  describe('CR-002: Pull Worker Error & Cursor Safety', () => {
    it('does not advance cursor if any record fails to apply in page', async () => {
      const db = getDatabase();
      db.execute(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
        ['sync_cursor', 'c0', '2026-01-01T00:00:00Z'],
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          request_id: '22222222-2222-2222-2222-222222222222',
          status: 'success',
          contract_version: 1,
          has_more: false,
          next_cursor: 'c1',
          records: [
            {
              collection: 'non_existent_table' as any,
              entity_id: 'id1',
              payload: {},
              revision: 1,
              occurred_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              tombstone: false,
            },
          ],
        }),
      });

      const startModule = require('../pullWorker');
      startModule.startPullWorker();
      await new Promise(resolve => setTimeout(resolve, 50));
      startModule.stopPullWorker();

      const res = db.execute(
        'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
        ['sync_cursor'],
      );
      expect(res.rows?.item(0).value).toBe('c0');
    });
  });

  describe('CR-003: Collection & Database Adapters', () => {
    it('applies grammar_bookmarks pull records matching SQLite schema', () => {
      applySyncRecord({
        collection: 'grammar_bookmarks',
        entity_id: 'lesson-101:grammar-202',
        payload: {
          lessonId: 'lesson-101',
          grammarId: 'grammar-202',
          packageId: 'pkg-99',
          active: true,
        },
        revision: 1,
        occurred_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-01T10:00:00Z',
        tombstone: false,
      });

      const bm = getGrammarBookmark('lesson-101', 'grammar-202');
      expect(bm).not.toBeNull();
      expect(bm?.packageId).toBe('pkg-99');
      expect(bm?.revision).toBe(1);
    });

    it('applies review_schedules to table review_schedule', () => {
      const db = getDatabase();
      applySyncRecord({
        collection: 'review_schedules',
        entity_id: 'card-abc',
        payload: {
          card_id: 'card-abc',
          lesson_id: 'lesson-1',
          interval_days: 3,
          next_review_at: '2026-01-10T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
        revision: 1,
        occurred_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        tombstone: false,
      });

      const res = db.execute(
        'SELECT * FROM review_schedule WHERE card_id = ?;',
        ['card-abc'],
      );
      expect(res.rows?.length).toBe(1);
    });
  });

  describe('CR-004: Outbox Starvation Fix', () => {
    it('drains new events even when 100 oldest events are stuck', async () => {
      for (let i = 0; i < 100; i++) {
        enqueueSyncOutboxEvent({
          id: `stuck-${i}`,
          entityId: `e-${i}`,
          payload: {},
          createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
        });
      }
      const stuckIds = listPendingSyncEvents({limit: 100}).map(e => e.id);
      for (let k = 0; k < 8; k++) {
        markSyncEventsFailed(stuckIds, 'STUCK_ERR');
      }

      enqueueSyncOutboxEvent({
        id: 'fresh-101',
        entityId: 'e-101',
        payload: {},
        createdAt: '2026-01-02T00:00:00Z',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          request_id: '33333333-3333-3333-3333-333333333333',
          status: 'success',
          accepted: 1,
          duplicates: 0,
          accepted_ids: ['fresh-101'],
          duplicate_ids: [],
        }),
      });

      const outcome = await drainOutboxOnce({fetchImpl: mockFetch});
      expect(outcome.status).toBe('synced');
      if (outcome.status === 'synced') {
        expect(outcome.syncedIds).toContain('fresh-101');
      }
    });
  });
});
