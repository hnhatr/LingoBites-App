import * as database from '@shared/db/database';
import {getDatabase} from '@shared/db/database';
import {listPendingSyncEvents} from '@modules/sync/adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '@modules/sync/outboxSync';
import {clearAllLocalDataWithFiles} from '@shared/localData/LocalDataDeletionService';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '@modules/account/useAccountStore';
import {
  confirmAccountSwitch,
  cancelAccountSwitch,
  resetBootStateForTests,
} from '@shared/auth/accountBootstrap';
import {
  confirmAccountSwitchAttempt,
  stageAccountSwitchAttempt,
} from '@shared/auth/accountSwitchCoordinator';
import * as accountSwitchJournal from '@shared/auth/accountSwitchJournal';
import * as authSession from '@shared/auth/authSession';
import {AUTH_ACTIVE_SESSION_SERVICE} from '@shared/auth/sessionStore';
import {
  bootStoreAuthenticated,
  createP2FetchMock,
  expectLearnerDataIntact,
  expectNoCrossAccountLeakUnderB,
  jsonResponse,
  P2_SESSION_B,
  P2_SESSION_C,
  P2_USER_A,
  P2_USER_B,
  P2_USER_C,
  seedActiveSessionA,
  seedInstall,
  seedSession,
  setupP2RealInfraHarness,
  stageAwaitingAB,
  teardownP2RealInfraHarness,
  writeP2LearnerData,
} from '@/test-support/p2RealInfra/harness';

jest.mock('@shared/db/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

describe('LING-110 TASK-023 P2 real-infra matrix (AC-008 / four triggers)', () => {
  let ctx: ReturnType<typeof setupP2RealInfraHarness>;

  beforeEach(() => {
    ctx = setupP2RealInfraHarness();
  });

  afterEach(() => {
    teardownP2RealInfraHarness();
  });

  it('P2-M-008-LOGOUT / AC-008: logout retains A learner rows and pending outbox', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await bootStoreAuthenticated();
    const pendingBefore = listPendingSyncEvents().length;

    await useAccountStore.getState().logout();
    expect(useAccountStore.getState().phase).toBe('signed-out');
    expectLearnerDataIntact();
    expect(listPendingSyncEvents()).toHaveLength(pendingBefore);
  });

  it('P2-M-008-SAME-ACCOUNT / AC-008: same-account re-login does not wipe or stage switch', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await bootStoreAuthenticated();
    await useAccountStore.getState().logout();
    ctx.serverUser.current = P2_USER_A;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'authenticated',
      user: {id: P2_USER_A.id},
    });
    expectLearnerDataIntact();
  });

  it('P2-M-012-PROMPT / AC-012: A→B boot stages confirmation before any delete', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    ctx.serverUser.current = P2_USER_B;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('switch-confirmation');
    expectLearnerDataIntact();
  });

  it('P2-M-013-CANCEL / AC-013: cancelSwitch preserves A and keeps A active', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    const staged = await stageAwaitingAB();
    ctx.serverUser.current = P2_USER_A;
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v1/auth/me')) {
          return jsonResponse(200, {
            request_id: 'm1',
            status: 'success',
            user: P2_USER_A,
          });
        }
        return createP2FetchMock(ctx.serverUser)(url, init);
      },
    );
    const cancelled = await cancelAccountSwitch(staged.attempt_id);
    expect(cancelled.status).toBe('authenticated');
    expectLearnerDataIntact();
  });

  it('P2-M-014-CONFIRM / AC-014: confirmSwitch wipes SQLite+outbox and activates B', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    ctx.serverUser.current = P2_USER_B;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('switch-confirmation');
    await useAccountStore.getState().confirmSwitch();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'authenticated',
      user: {id: P2_USER_B.id},
    });
    expectNoCrossAccountLeakUnderB();
    const accountId = getDatabase()
      .execute(
        "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
      )
      .rows?.item(0) as {value?: string};
    expect(accountId?.value).toBe(P2_USER_B.id);
  });

  it('P2-M-008-EXPLICIT-DELETE / AC-016: explicit deletion clears DB separately from A→B', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await bootStoreAuthenticated();
    const result = await clearAllLocalDataWithFiles({
      fileDeleter: async () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.dbCleared).toBe(true);
    expect(listPendingSyncEvents()).toEqual([]);
    expect(useAccountStore.getState().phase).toBe('authenticated');
  });
});

describe('LING-110 TASK-023 P2 real-infra matrix (AC-015 / recovery / failures)', () => {
  beforeEach(() => {
    setupP2RealInfraHarness();
  });

  afterEach(() => {
    teardownP2RealInfraHarness();
  });

  it('P2-M-015-RECOVERY / AC-015: restart while awaiting never wipes A', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await stageAwaitingAB();
    resetBootStateForTests();
    resetAccountStoreForTests();
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState().phase).toBe('switch-confirmation');
    expectLearnerDataIntact();
  });

  it('P2-M-015-OFFLINE-CONFIRM / AC-015: confirm completes with fetch unavailable', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    const staged = await stageAwaitingAB();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;
    const result = await confirmAccountSwitch(staged.attempt_id);
    expect(result.status).toBe('authenticated');
    expectNoCrossAccountLeakUnderB();
  });

  it('P2-M-FAIL-JOURNAL / AC-015: journal confirm failure leaves A rows intact', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    const staged = await stageAwaitingAB();
    jest
      .spyOn(accountSwitchJournal, 'writeAccountSwitchJournal')
      .mockResolvedValueOnce({ok: false, errorCode: 'KEYCHAIN_ERROR'});
    const result = await confirmAccountSwitch(staged.attempt_id);
    expect(result.status).toBe('failed');
    expectLearnerDataIntact();
  });

  it('P2-M-FAIL-DB / AC-015: replacement transaction failure preserves A', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    const staged = await stageAwaitingAB();
    jest
      .spyOn(database, 'executeAccountReplacementTransaction')
      .mockImplementation(() => {
        throw new Error('injected db failure');
      });
    const result = await confirmAccountSwitch(staged.attempt_id);
    expect(result.status).toBe('failed');
    expect(result.status === 'failed' && result.code).toBe(
      'ACCOUNT_REPLACEMENT_FAILED',
    );
    expectLearnerDataIntact();
  });

  it('P2-M-FAIL-POINTER / AC-015: activation failure after DB commit is failed, not silent B', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    const staged = await stageAwaitingAB();
    jest.spyOn(authSession, 'activateStoredSession').mockResolvedValueOnce({
      ok: false,
      error: new Error('KEYCHAIN_ERROR'),
    });
    const result = await confirmAccountSwitch(staged.attempt_id);
    expect(result.status).toBe('failed');
    expectNoCrossAccountLeakUnderB();
  });

  it('P2-M-BTOC-TARGET / AC-012: replacing awaiting B with C keeps A data until confirm', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await stageAwaitingAB();
    const replaced = await stageAccountSwitchAttempt({
      sourceAccountId: P2_USER_A.id,
      targetAccountId: P2_USER_C.id,
      targetSessionId: '77777777-7777-4777-8777-777777777777',
      targetUserSnapshot: P2_USER_C,
    });
    expect(replaced.ok).toBe(true);
    expectLearnerDataIntact();
  });

  it('P2-M-DUP-ATTEMPT / AC-015: staging while confirmed journal is locked', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    const staged = await stageAwaitingAB();
    await confirmAccountSwitchAttempt(staged.attempt_id, {
      sourceAccountId: P2_USER_A.id,
      targetAccountId: P2_USER_B.id,
    });
    const blocked = await stageAccountSwitchAttempt({
      sourceAccountId: P2_USER_A.id,
      targetAccountId: P2_USER_C.id,
      targetSessionId: P2_SESSION_C.session_id,
      targetUserSnapshot: P2_USER_C,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.errorCode).toBe(
      'CONFIRMED_ATTEMPT_LOCKED',
    );
    expectLearnerDataIntact();
  });
});

describe('LING-110 TASK-023 P2 real-infra matrix (INV-002 replay)', () => {
  beforeEach(() => {
    setupP2RealInfraHarness();
  });

  afterEach(() => {
    teardownP2RealInfraHarness();
  });

  it('P2-M-BTOB-REPLAY / AC-014: in-flight drain must not send A events under B token', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    const pending = listPendingSyncEvents();
    const reviewEvent = pending.find(e => e.eventType === 'review');
    expect(reviewEvent).toBeDefined();

    const Keychain = jest.requireMock('react-native-keychain') as {
      getGenericPassword: jest.Mock;
    };
    const realGet = Keychain.getGenericPassword.getMockImplementation();
    if (!realGet) {
      throw new Error('expected Keychain mock');
    }
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

    const sent: string[] = [];
    const baseFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const auth = headers.Authorization ?? headers.authorization;
      if (String(url).endsWith('/v1/review-events') && init?.body) {
        sent.push(String(auth));
      }
      return baseFetch(url, init);
    }) as unknown as typeof fetch;

    const staged = await stageAwaitingAB();
    const drainPromise = drainOutboxOnce();
    await reachedP;
    await confirmAccountSwitch(staged.attempt_id);
    release();
    await drainPromise;

    expect(
      sent.filter(a => a === `Bearer ${P2_SESSION_B.access_token}`),
    ).toEqual([]);
  });
});
