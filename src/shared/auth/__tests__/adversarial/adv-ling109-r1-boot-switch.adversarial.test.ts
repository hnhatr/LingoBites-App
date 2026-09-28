import {validFullOutput} from '@shared/fixtures';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {
  getYouTubeProgress,
  saveYouTubeProgress,
} from '@shared/db/YouTubeProgressRepository';
import {recordFlashcardRating, saveFlashcard} from '@modules/review';
import {saveContentLesson} from '@shared/db/ContentLessonStateRepository';
import {listPendingSyncEvents} from '@modules/sync/adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '@modules/sync/outboxSync';
import * as DeviceIdentityNative from '@shared/identity/deviceIdentityNative';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '@modules/account/useAccountStore';
import {resetBootStateForTests, bootAccount} from '../../accountBootstrap';
import {confirmAccountSwitch} from '../../accountBootstrap';
import {resetRefreshStateForTests} from '../../authSession';
import {
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
  confirmAccountSwitchAttempt,
} from '../../accountSwitchCoordinator';
import {
  AUTH_ACTIVE_SESSION_SERVICE,
  saveSession,
  setActiveSessionId,
} from '../../sessionStore';
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
 * LING-109 adversarial review (TASK-021). Production boot/session integration
 * and account-switch gate on a real SQLite engine; only the network (fetch)
 * and the Keychain native module are doubled.
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
const userC = makeUser('55555555-5555-4555-8555-555555555555', 'CCCC');

const sessionA = {
  session_id: '33333333-3333-4333-8333-333333333333',
  access_token: 'lb_at_a',
  refresh_token: 'lb_rt_a',
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
const sessionC = {
  session_id: '66666666-6666-4666-8666-666666666666',
  access_token: 'lb_at_c',
  refresh_token: 'lb_rt_c',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

let serverUser: AuthUser = userA;

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

const baseFetch = jest.fn(async (url: string, _init?: any) => {
  if (url.endsWith('/v1/auth/bootstrap')) {
    return json(200, {
      request_id: 'b',
      status: 'authenticated',
      user: serverUser,
      session:
        serverUser.id === userB.id
          ? sessionB
          : serverUser.id === userC.id
          ? sessionC
          : sessionA,
    });
  }
  if (url.endsWith('/v1/auth/logout')) return json(200, {status: 'success'});
  if (url.endsWith('/v1/auth/me')) {
    return json(200, {request_id: 'm', status: 'success', user: serverUser});
  }
  return json(404, {});
});
const mockFetch = jest.fn(baseFetch);
global.fetch = mockFetch as unknown as typeof fetch;

let db: RealSqliteConnection;

function seedInstall(accountId: string) {
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

async function seedSession(session: typeof sessionA, userId: string) {
  await saveSession({
    ...session,
    user_id: userId,
    stored_at: '2026-09-27T00:00:00.000Z',
  });
}

async function seedActiveSessionA() {
  await seedSession(sessionA, userA.id);
  await setActiveSessionId(sessionA.session_id);
}

async function stageAwaitingAB() {
  const staged = await stageAccountSwitchAttempt({
    sourceAccountId: userA.id,
    targetAccountId: userB.id,
    targetSessionId: sessionB.session_id,
    targetUserSnapshot: userB,
  });
  if (!staged.ok) throw new Error('stage failed');
  return staged.value;
}

async function confirmJournalAB() {
  const staged = await stageAwaitingAB();
  await confirmAccountSwitchAttempt(staged.attempt_id, {
    sourceAccountId: userA.id,
    targetAccountId: userB.id,
  });
  return staged;
}

beforeEach(() => {
  db = openRealSqlite(':memory:');
  resetDatabaseForTests(db);
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountSwitchCoordinatorForTests();
  resetAccountStoreForTests();
  serverUser = userA;
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

describe('ADV-001 / INV-002+INV-003: in-flight outbox drain across a confirmed A→B switch', () => {
  it('ADV-001 / INV-002+INV-003: a sync drain started under A must not deliver A events with B session after an A→B confirm', async () => {
    await seedActiveSessionA();
    seedInstall(userA.id);
    writeLearnerData();
    await seedSession(sessionB, userB.id);

    const pendingBefore = listPendingSyncEvents();
    const reviewEvent = pendingBefore.find(e => e.eventType === 'review');
    expect(reviewEvent).toBeDefined();

    // Barrier at the async Keychain boundary: hold the drain's active-session
    // read until the account switch has fully committed and activated B.
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

    const sent: Array<{url: string; auth?: string; body: string}> = [];
    mockFetch.mockImplementation(async (url: string, init?: any) => {
      const headers = init?.headers ?? {};
      sent.push({
        url: String(url),
        auth: headers.Authorization ?? headers.authorization,
        body: typeof init?.body === 'string' ? init.body : '',
      });
      if (String(url).endsWith('/v1/review-events')) {
        const parsed = JSON.parse(init.body);
        return json(200, {
          status: 'success',
          accepted_ids: parsed.events.map((e: {id: string}) => e.id),
          duplicate_ids: [],
        });
      }
      return baseFetch(url, init);
    });

    const staged = await stageAwaitingAB();
    const drainPromise = drainOutboxOnce();
    await reachedP;

    const confirmed = await confirmAccountSwitch(staged.attempt_id);
    expect(confirmed.status).toBe('authenticated');

    release();
    await drainPromise;

    const leaked = sent.filter(
      request =>
        request.auth === `Bearer ${sessionB.access_token}` &&
        reviewEvent !== undefined &&
        request.body.includes(reviewEvent.id),
    );
    expect(leaked).toEqual([]);
  });
});

describe('HELD / INV-001: unconfirmed and same-account paths never delete A data', () => {
  it('HELD / INV-001: restart while awaiting confirmation never wipes A and never mounts Tabs', async () => {
    await seedActiveSessionA();
    seedInstall(userA.id);
    writeLearnerData();
    await stageAwaitingAB();

    serverUser = userA;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('switch-confirmation');
    expect(getYouTubeProgress('yt-a')).not.toBeNull();
    expect(listPendingSyncEvents()).toHaveLength(2);

    // process restart
    resetBootStateForTests();
    resetRefreshStateForTests();
    resetAccountSwitchCoordinatorForTests();
    resetAccountStoreForTests();
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('switch-confirmation');
    expect(getYouTubeProgress('yt-a')).not.toBeNull();
    expect(listPendingSyncEvents()).toHaveLength(2);
  });

  it('HELD / INV-001: same-account re-login preserves data and stages no switch', async () => {
    await seedActiveSessionA();
    seedInstall(userA.id);
    writeLearnerData();

    await useAccountStore.getState().logout();
    expect(useAccountStore.getState().phase).toBe('signed-out');
    serverUser = userA;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'authenticated',
      user: {id: userA.id},
    });
    expect(getYouTubeProgress('yt-a')).not.toBeNull();
    expect(listPendingSyncEvents()).toHaveLength(2);
  });

  it('HELD / INV-001: a foreign active session with a pending journal fails closed', async () => {
    await seedSession(sessionC, userC.id);
    await setActiveSessionId(sessionC.session_id);
    seedInstall(userA.id);
    writeLearnerData();
    await stageAwaitingAB();

    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('switch-failed');
    expect(getYouTubeProgress('yt-a')).not.toBeNull();
    expect(listPendingSyncEvents()).toHaveLength(2);
  });
});

describe('HELD / INV-003: confirmed switch ordering and isolation', () => {
  it('HELD / INV-003: confirmed journal with DB still A prompts retry and preserves A rows', async () => {
    await seedActiveSessionA();
    seedInstall(userA.id);
    writeLearnerData();
    await seedSession(sessionB, userB.id);
    await confirmJournalAB();

    serverUser = userA;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('switch-confirmation');
    expect(useAccountStore.getState().switchContext?.needsRetry).toBe(true);
    expect(getYouTubeProgress('yt-a')).not.toBeNull();
    expect(listPendingSyncEvents()).toHaveLength(2);
  });

  it('HELD / INV-003: recovered activated switch leaves no A row queryable under B', async () => {
    await seedActiveSessionA();
    // DB commit proof: current_account_id already B
    seedInstall(userB.id);
    writeLearnerData();
    await seedSession(sessionB, userB.id);
    await confirmJournalAB();
    getDatabase().execute('DELETE FROM youtube_progress;');
    getDatabase().execute('DELETE FROM sync_outbox;');

    await useAccountStore.getState().boot();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'authenticated',
      user: {id: userB.id},
    });
    expect(getYouTubeProgress('yt-a')).toBeNull();
    expect(listPendingSyncEvents()).toEqual([]);
  });
});

describe('HELD / INV-004: no candidate token leaks through BootResult', () => {
  it('HELD / INV-004: switch-confirmation BootResult carries no session token fields', async () => {
    await seedActiveSessionA();
    seedInstall(userA.id);
    writeLearnerData();
    await stageAwaitingAB();
    serverUser = userA;

    const result = await bootAccount({platform: 'android'});
    expect(result.status).toBe('switch-confirmation');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(sessionB.access_token);
    expect(serialized).not.toContain(sessionB.refresh_token);
  });
});
