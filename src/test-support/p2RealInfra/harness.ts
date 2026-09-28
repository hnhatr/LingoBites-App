import {validFullOutput} from '@shared/fixtures';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {
  getYouTubeProgress,
  saveYouTubeProgress,
} from '@shared/db/YouTubeProgressRepository';
import {recordFlashcardRating, saveFlashcard} from '@modules/review';
import {saveContentLesson} from '@shared/db/ContentLessonStateRepository';
import {listPendingSyncEvents} from '@modules/sync/adapters/SyncOutboxRepository';
import * as DeviceIdentityNative from '@shared/identity/deviceIdentityNative';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '@modules/account/useAccountStore';
import {resetBootStateForTests} from '@shared/auth/accountBootstrap';
import {resetRefreshStateForTests} from '@shared/auth/authSession';
import {
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '@shared/auth/accountSwitchCoordinator';
import {
  getActiveSessionId,
  saveSession,
  setActiveSessionId,
} from '@shared/auth/sessionStore';
import {installKeychainVault} from '@/test-support/keychainVault';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';
import type {AuthSession, AuthUser} from '@shared/auth/authTypes';

export const P2_USER_A: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AAAA',
  display_name: 'User A',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

export const P2_USER_B: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  public_code: 'LB-BBBB',
  display_name: 'User B',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

export const P2_USER_C: AuthUser = {
  id: '55555555-5555-4555-8555-555555555555',
  public_code: 'LB-CCCC',
  display_name: 'User C',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

export const P2_SESSION_A: AuthSession = {
  session_id: '33333333-3333-4333-8333-333333333333',
  access_token: 'lb_at_a',
  refresh_token: 'lb_rt_a',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

export const P2_SESSION_B: AuthSession = {
  session_id: '44444444-4444-4444-8444-444444444444',
  access_token: 'lb_at_b',
  refresh_token: 'lb_rt_b',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

export const P2_SESSION_C: AuthSession = {
  session_id: '66666666-6666-4666-8666-666666666666',
  access_token: 'lb_at_c',
  refresh_token: 'lb_rt_c',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

export function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

export function seedInstall(accountId: string) {
  const conn = getDatabase();
  conn.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', accountId, '2026-09-27T00:00:00.000Z'],
  );
  conn.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [
      'account.install_completed_v1',
      '2026-09-27T00:00:00.000Z',
      '2026-09-27T00:00:00.000Z',
    ],
  );
}

export function writeP2LearnerData() {
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

export async function seedSession(
  session: AuthSession,
  userId: string,
): Promise<void> {
  await saveSession({
    ...session,
    user_id: userId,
    stored_at: '2026-09-27T00:00:00.000Z',
  });
}

export async function seedActiveSessionA() {
  await seedSession(P2_SESSION_A, P2_USER_A.id);
  await setActiveSessionId(P2_SESSION_A.session_id);
}

export function totalNonSettingsRows(): number {
  const db = getDatabase();
  const tables = db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'app_settings'",
  ).rows!._array as Array<{name: string}>;
  let total = 0;
  for (const {name} of tables) {
    total += Number(
      (
        db.execute(`SELECT COUNT(*) AS c FROM ${name}`).rows!.item(0) as {
          c: number;
        }
      ).c,
    );
  }
  return total;
}

export type P2HarnessContext = {
  db: RealSqliteConnection;
  serverUser: {current: AuthUser};
  mockFetch: jest.Mock;
};

function meResponse(user: AuthUser) {
  return jsonResponse(200, {
    request_id: 'm',
    status: 'success',
    user,
  });
}

export function createP2FetchMock(serverUser: {current: AuthUser}) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/auth/bootstrap')) {
      const user = serverUser.current;
      const session =
        user.id === P2_USER_B.id
          ? P2_SESSION_B
          : user.id === P2_USER_C.id
          ? P2_SESSION_C
          : P2_SESSION_A;
      return jsonResponse(200, {
        request_id: 'b',
        status: 'authenticated',
        user,
        session,
      });
    }
    if (url.endsWith('/v1/auth/logout')) {
      return jsonResponse(200, {status: 'success'});
    }
    if (url.endsWith('/v1/auth/refresh')) {
      const rotated = {
        ...P2_SESSION_A,
        access_token: 'lb_at_rotated',
        access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      };
      return jsonResponse(200, {
        request_id: 'r1',
        status: 'rotated',
        session: rotated,
      });
    }
    if (url.endsWith('/v1/me') || url.endsWith('/v1/auth/me')) {
      return meResponse(serverUser.current);
    }
    if (String(url).endsWith('/v1/review-events') && init?.body) {
      const parsed = JSON.parse(String(init.body));
      return jsonResponse(200, {
        status: 'success',
        accepted_ids: parsed.events.map((e: {id: string}) => e.id),
        duplicate_ids: [],
      });
    }
    return jsonResponse(404, {});
  });
}

export function setupP2RealInfraHarness(): P2HarnessContext {
  const db = openRealSqlite(':memory:');
  resetDatabaseForTests(db);
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountSwitchCoordinatorForTests();
  resetAccountStoreForTests();
  const serverUser = {current: P2_USER_A};
  const mockFetch = createP2FetchMock(serverUser);
  global.fetch = mockFetch as unknown as typeof fetch;
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({
      androidId: 'a1b2c3d4e5f60718',
      identifierForVendor: null,
    });
  return {db, serverUser, mockFetch};
}

export function teardownP2RealInfraHarness() {
  jest.restoreAllMocks();
  resetDatabaseForTests(null);
}

export async function stageAwaitingAB() {
  const staged = await stageAccountSwitchAttempt({
    sourceAccountId: P2_USER_A.id,
    targetAccountId: P2_USER_B.id,
    targetSessionId: P2_SESSION_B.session_id,
    targetUserSnapshot: P2_USER_B,
  });
  if (!staged.ok) {
    throw new Error(`stage failed: ${staged.errorCode}`);
  }
  return staged.value;
}

export function expectLearnerDataIntact() {
  expect(getYouTubeProgress('yt-a')).not.toBeNull();
  expect(listPendingSyncEvents().length).toBeGreaterThan(0);
}

export function expectNoCrossAccountLeakUnderB() {
  expect(getYouTubeProgress('yt-a')).toBeNull();
  expect(listPendingSyncEvents()).toEqual([]);
  expect(totalNonSettingsRows()).toBe(0);
}

export function readCurrentAccountId(): string | undefined {
  const row = getDatabase()
    .execute(
      "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
    )
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value;
}

export async function expectLearnerContextIsAccountA() {
  expect(readCurrentAccountId()).toBe(P2_USER_A.id);
  await expect(getActiveSessionId()).resolves.toEqual({
    ok: true,
    value: P2_SESSION_A.session_id,
  });
}

export async function expectLearnerContextIsAccountB() {
  expect(readCurrentAccountId()).toBe(P2_USER_B.id);
  await expect(getActiveSessionId()).resolves.toEqual({
    ok: true,
    value: P2_SESSION_B.session_id,
  });
}

export async function expectAccountBNotActive() {
  expect(readCurrentAccountId()).toBe(P2_USER_A.id);
  await expect(getActiveSessionId()).resolves.toEqual({
    ok: true,
    value: P2_SESSION_A.session_id,
  });
}

export async function bootStoreAuthenticated() {
  await useAccountStore.getState().boot();
  expect(useAccountStore.getState().phase).toBe('authenticated');
}
