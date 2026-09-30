import {
  confirmAccountSwitch,
  resetBootStateForTests,
} from '@features/account/logic/accountBootstrap';
import {resetAccountStoreForTests} from '@features/account/logic/useAccountStore';
import {saveContentLesson} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {recordFlashcardRating, saveFlashcard} from '@features/review';
import {drainOutboxOnce} from '@features/sync/logic/outboxSync';
import {saveYouTubeProgress} from '@features/youtube/logic/data/YouTubeProgressRepository';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {validFullOutput} from '@core/fixtures';
import * as DeviceIdentityNative from '@core/identity/deviceIdentityNative';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {installKeychainVault} from '@test/support/keychainVault';

import {
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '../../accountSwitchCoordinator';
import {createAuthClient} from '../../authClient';
import {ensureValidSession, resetRefreshStateForTests} from '../../authSession';
import type {AuthUser} from '../../authTypes';
import {
  AUTH_ACTIVE_SESSION_SERVICE,
  clearAllSessions,
  getActiveSession,
  getActiveSessionId,
  saveSession,
  setActiveSessionId,
} from '../../sessionStore';

jest.mock('@features/account/logic/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

/**
 * LING-109 adversarial re-review r4 (TASK-021): positive attacks on the FIFO
 * active-pointer lock added for ADV-004/CR-008. All must hold: after any
 * refresh/activation interleaving, `current_account_id` and the active pointer
 * both name the account the confirmed switch activated.
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

const userA = makeUser('11111111-1111-4111-8111-111111111111', 'AAAA');
const userB = makeUser('22222222-2222-4222-8222-222222222222', 'BBBB');

const expiredA = {
  session_id: '33333333-3333-4333-8333-333333333333',
  access_token: 'lb_at_a_old',
  refresh_token: 'lb_rt_a',
  access_expires_at: new Date(Date.now() - 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};
const rotatedA = {
  session_id: expiredA.session_id,
  access_token: 'lb_at_a_new',
  refresh_token: 'lb_rt_a_new',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};
const sessionB = {
  session_id: '44444444-4444-4444-8444-444444444444',
  access_token: 'lb_at_b',
  refresh_token: 'lb_rt_b',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(body),
});

const baseFetch = jest.fn(async (url: string, _init?: any) => {
  if (url.endsWith('/v1/auth/bootstrap')) {
    return json(200, {
      request_id: 'b',
      status: 'authenticated',
      user: userA,
      session: sessionB,
    });
  }
  if (url.endsWith('/v1/auth/logout')) return json(200, {status: 'success'});
  if (url.endsWith('/v1/auth/me')) {
    return json(200, {request_id: 'm', status: 'success', user: userA});
  }
  return json(404, {});
});
const mockFetch = jest.fn(baseFetch);
global.fetch = mockFetch as unknown as typeof fetch;

let db: RealSqliteConnection;

function seedInstall(accountId: string) {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', accountId, '2026-09-27T00:00:00.000Z'],
  );
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [
      'account.install_completed_v1',
      '2026-09-27T00:00:00.000Z',
      '2026-09-27T00:00:00.000Z',
    ],
  );
}

function writeLearnerData() {
  saveYouTubeProgress({lessonId: 'yt-a', positionMs: 5000, segmentIndex: 2});
  const saved = saveFlashcard({
    lessonId: 'lesson-a',
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-09-27T01:00:00.000Z',
  });
  if (!saved.ok) throw new Error('saveFlashcard failed');
  recordFlashcardRating({
    flashcardId: saved.flashcardId,
    rating: 'remembered',
    reviewedAt: '2026-09-27T02:00:00.000Z',
  });
  saveContentLesson({lessonId: 'content-a', now: '2026-09-27T03:00:00.000Z'});
}

function readCurrentAccountId(): string | null {
  const row = getDatabase()
    .execute(
      "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
    )
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

async function seedSwitchScenario() {
  await saveSession({
    ...expiredA,
    user_id: userA.id,
    stored_at: '2026-09-27T00:00:00.000Z',
  });
  await setActiveSessionId(expiredA.session_id);
  seedInstall(userA.id);
  writeLearnerData();
  await saveSession({
    ...sessionB,
    user_id: userB.id,
    stored_at: '2026-09-27T00:00:00.000Z',
  });
  const staged = await stageAccountSwitchAttempt({
    sourceAccountId: userA.id,
    targetAccountId: userB.id,
    targetSessionId: sessionB.session_id,
    targetUserSnapshot: userB,
  });
  if (!staged.ok) throw new Error('stage failed');
  return staged.value.attempt_id;
}

async function expectSwitchConvergesToB() {
  const active = await getActiveSession();
  expect(readCurrentAccountId()).toBe(userB.id);
  expect(active.ok).toBe(true);
  if (!active.ok) throw new Error('expected active session');
  expect(active.value?.user_id).toBe(userB.id);
  expect(active.value?.session_id).toBe(sessionB.session_id);
}

beforeEach(() => {
  db = openRealSqlite(':memory:');
  resetDatabaseForTests(db);
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountSwitchCoordinatorForTests();
  resetAccountStoreForTests();
  mockFetch.mockReset();
  mockFetch.mockImplementation(baseFetch);
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

describe('HELD / INV-003: FIFO active-pointer lock ordering', () => {
  it('HELD / INV-003: an activation queued during the refresh ownership read still wins', async () => {
    const attemptId = await seedSwitchScenario();

    // Pause the refresh's in-lock ownership read (getActiveSession) so the
    // switch's activateStoredSession(B) is queued behind the held lock.
    const Keychain = jest.requireMock('react-native-keychain') as any;
    const realGet = Keychain.getGenericPassword.getMockImplementation();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    Keychain.getGenericPassword.mockImplementation(
      async (options: {service?: string}) => {
        if (!paused && options?.service === AUTH_ACTIVE_SESSION_SERVICE) {
          paused = true;
          reached();
          await gate;
        }
        return realGet(options);
      },
    );

    mockFetch.mockImplementation(async (url: string, init?: any) => {
      if (url.endsWith('/v1/auth/refresh')) {
        return json(200, {status: 'rotated', session: rotatedA});
      }
      return baseFetch(url, init);
    });

    const drainPromise = drainOutboxOnce();
    await reachedP;

    const confirmPromise = confirmAccountSwitch(attemptId);
    release();
    const [confirmed] = await Promise.all([confirmPromise, drainPromise]);
    expect(confirmed.status).toBe('authenticated');

    await expectSwitchConvergesToB();
  });

  it('HELD / INV-003: a refresh queued behind an in-progress activation aborts and cannot overwrite B', async () => {
    const attemptId = await seedSwitchScenario();

    // Pause the switch's activation pointer write; the refresh then queues behind it.
    const Keychain = jest.requireMock('react-native-keychain') as any;
    const realSet = Keychain.setGenericPassword.getMockImplementation();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    Keychain.setGenericPassword.mockImplementation(
      async (
        username: string,
        password: string,
        options?: {service?: string},
      ) => {
        if (
          !paused &&
          options?.service === AUTH_ACTIVE_SESSION_SERVICE &&
          password === sessionB.session_id
        ) {
          paused = true;
          reached();
          await gate;
        }
        return realSet(username, password, options);
      },
    );

    mockFetch.mockImplementation(async (url: string, init?: any) => {
      if (url.endsWith('/v1/auth/refresh')) {
        return json(200, {status: 'rotated', session: rotatedA});
      }
      return baseFetch(url, init);
    });

    const confirmPromise = confirmAccountSwitch(attemptId);
    await reachedP;

    const refreshPromise = drainOutboxOnce();
    release();
    const [confirmed] = await Promise.all([confirmPromise, refreshPromise]);
    expect(confirmed.status).toBe('authenticated');

    await expectSwitchConvergesToB();
  });

  it('HELD / INV-003: concurrent refresh and confirm converge to B (5 iterations)', async () => {
    for (let i = 0; i < 5; i += 1) {
      installKeychainVault();
      resetRefreshStateForTests();
      resetAccountSwitchCoordinatorForTests();
      resetDatabaseForTests(openRealSqlite(':memory:'));
      const attemptId = await seedSwitchScenario();
      mockFetch.mockImplementation(async (url: string, init?: any) => {
        if (url.endsWith('/v1/auth/refresh')) {
          return json(200, {status: 'rotated', session: rotatedA});
        }
        return baseFetch(url, init);
      });
      const [confirmResult] = await Promise.all([
        confirmAccountSwitch(attemptId),
        drainOutboxOnce(),
      ]);
      expect(confirmResult.status).toBe('authenticated');
      await expectSwitchConvergesToB();
    }
  });

  it('HELD / INV-001: a logout racing an in-flight refresh is not undone by the stale pointer write', async () => {
    await saveSession({
      ...expiredA,
      user_id: userA.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });
    await setActiveSessionId(expiredA.session_id);
    seedInstall(userA.id);

    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    mockFetch.mockImplementation(async (url: string, init?: any) => {
      if (!paused && url.endsWith('/v1/auth/refresh')) {
        paused = true;
        reached();
        await gate;
        return json(200, {status: 'rotated', session: rotatedA});
      }
      return baseFetch(url, init);
    });

    const refreshPromise = ensureValidSession({client: createAuthClient()});
    await reachedP;

    await clearAllSessions();
    release();
    await refreshPromise;

    const pointer = await getActiveSessionId();
    expect(pointer.ok && pointer.value).toBeNull();
    const active = await getActiveSession();
    expect(active.ok && active.value).toBeNull();
  });
});
