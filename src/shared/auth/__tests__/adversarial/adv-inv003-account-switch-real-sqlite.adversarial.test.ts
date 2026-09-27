import {validFullOutput} from '@shared/fixtures';
import {resetDatabaseForTests} from '@shared/db/database';
import {
  getYouTubeProgress,
  saveYouTubeProgress,
} from '@shared/db/YouTubeProgressRepository';
import {
  listFlashcards,
  recordFlashcardRating,
  saveFlashcard,
} from '@shared/db/FlashcardRepository';
import {saveContentLesson} from '@shared/db/ContentLessonStateRepository';
import {listPendingSyncEvents} from '@shared/db/SyncOutboxRepository';
import * as DeviceIdentityNative from '@shared/identity/deviceIdentityNative';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '@modules/account/useAccountStore';
import {resetBootStateForTests} from '../../accountBootstrap';
import {resetRefreshStateForTests} from '../../authSession';
import {installKeychainVault} from '@/test-support/keychainVault';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';
import type {AuthUser} from '../../authTypes';

jest.mock('../../../db/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

/**
 * LING-93 adversarial review (INV-003 / HC-005). The production account store
 * (`boot` / `logout`) drives `bootAccount` → `enforceAccountIsolation` →
 * `wipeDatabase` on a real SQLite engine. Only the network (fetch) and the
 * Keychain native module are doubled.
 */

function makeUser(id: string, name: string): AuthUser {
  return {
    id,
    public_code: `LB-${name}`,
    display_name: name,
    phone_e164: null,
    status: 'active',
    created_at: '2026-09-27T00:00:00.000Z',
    updated_at: '2026-09-27T00:00:00.000Z',
  };
}

const userA = makeUser('11111111-1111-4111-8111-111111111111', 'AAAA1111');
const userB = makeUser('22222222-2222-4222-8222-222222222222', 'BBBB2222');

let serverUser: AuthUser = userA;
let sessionSeq = 0;

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

const mockFetch = jest.fn(async (url: string) => {
  if (url.endsWith('/v1/auth/bootstrap')) {
    sessionSeq += 1;
    return json(200, {
      request_id: `b${sessionSeq}`,
      status: 'authenticated',
      user: serverUser,
      session: {
        session_id: `33333333-3333-4333-8333-33333333333${sessionSeq}`,
        access_token: `lb_at_${sessionSeq}`,
        refresh_token: `lb_rt_${sessionSeq}`,
        access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      },
    });
  }
  if (url.endsWith('/v1/auth/logout')) {
    return json(200, {request_id: 'l', status: 'success'});
  }
  if (url.endsWith('/v1/auth/me')) {
    return json(200, {request_id: 'm', status: 'success', user: serverUser});
  }
  return json(404, {});
});
global.fetch = mockFetch as unknown as typeof fetch;

let db: RealSqliteConnection;

function tableCounts(): Record<string, number> {
  const tables = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ).rows!._array as Array<{name: string}>;
  const counts: Record<string, number> = {};
  for (const {name} of tables) {
    counts[name] = Number(
      (
        db.execute(`SELECT COUNT(*) AS c FROM ${name}`).rows!.item(0) as {
          c: number;
        }
      ).c,
    );
  }
  return counts;
}

function writeLearnerDataAsCurrentUser() {
  saveYouTubeProgress({lessonId: 'yt-a', positionMs: 5000, segmentIndex: 2});
  const saved = saveFlashcard({
    lessonId: 'lesson-a',
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-09-27T01:00:00.000Z',
  });
  if (!saved.ok) {
    throw new Error('saveFlashcard failed');
  }
  recordFlashcardRating({
    flashcardId: saved.flashcardId,
    rating: 'remembered',
    reviewedAt: '2026-09-27T02:00:00.000Z',
  });
  saveContentLesson({lessonId: 'content-a', now: '2026-09-27T03:00:00.000Z'});
}

beforeEach(() => {
  db = openRealSqlite(':memory:');
  resetDatabaseForTests(db);
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountStoreForTests();
  serverUser = userA;
  sessionSeq = 0;
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({
      androidId: 'a1b2c3d4e5f60718',
      identifierForVendor: null,
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  resetDatabaseForTests(null);
});

describe('ADV / INV-003 production account switch on real SQLite', () => {
  it('ADV-H06 / INV-003: logout + re-login as the same account keeps learner data (current wipe semantics)', async () => {
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'authenticated',
      user: {id: userA.id},
    });
    writeLearnerDataAsCurrentUser();

    await useAccountStore.getState().logout();
    expect(useAccountStore.getState().phase).toBe('signed-out');

    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().user?.id).toBe(userA.id);
    expect(getYouTubeProgress('yt-a')?.positionMs).toBe(5000);
    expect(listFlashcards()).toHaveLength(1);
    expect(listPendingSyncEvents()).toHaveLength(2); // review + content_lesson_state
  });

  /**
   * Pre-decision characterization of current wipe semantics (pending Q-001).
   * Not an approved product oracle for A→B pending-outbox retention.
   */
  it('ADV-H07 / INV-003: logout A → login B leaves no A-owned learner row in ANY table and no A outbox event to replay under B', async () => {
    await useAccountStore.getState().boot();
    writeLearnerDataAsCurrentUser();
    expect(listPendingSyncEvents()).toHaveLength(2); // review + content_lesson_state

    await useAccountStore.getState().logout();
    serverUser = userB;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'authenticated',
      user: {id: userB.id},
    });

    const counts = tableCounts();
    const nonEmpty = Object.entries(counts).filter(
      ([name, c]) => c > 0 && name !== 'app_settings',
    );
    expect(nonEmpty).toEqual([]);
    const settings = db.execute('SELECT key, value FROM app_settings').rows!
      ._array as Array<{key: string; value: string}>;
    expect(settings.map(s => s.value)).not.toContain(userA.id);
    expect(settings).toContainEqual(
      expect.objectContaining({key: 'current_account_id', value: userB.id}),
    );
    expect(getYouTubeProgress('yt-a')).toBeNull();
    expect(listPendingSyncEvents()).toEqual([]);
  });
});
