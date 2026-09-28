import * as database from '@core/db/database';
import {getDatabase} from '@core/db/database';
import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '@features/sync/logic/outboxSync';
import {clearAllLocalDataWithFiles} from '@features/profile/logic/LocalDataDeletionService';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '@features/account/logic/useAccountStore';
import {
  confirmAccountSwitch,
  cancelAccountSwitch,
  resetBootStateForTests,
} from '@features/account/logic/accountBootstrap';
import {
  confirmAccountSwitchAttempt,
  stageAccountSwitchAttempt,
} from '@core/auth/accountSwitchCoordinator';
import * as accountSwitchJournal from '@core/auth/accountSwitchJournal';
import {readAccountSwitchJournal} from '@core/auth/accountSwitchJournal';
import * as authSession from '@core/auth/authSession';
import {AUTH_ACTIVE_SESSION_SERVICE} from '@core/auth/sessionStore';
import {
  bootStoreAuthenticated,
  createP2FetchMock,
  expectAccountBNotActive,
  expectLearnerContextIsAccountA,
  expectLearnerContextIsAccountB,
  expectLearnerDataIntact,
  expectNoCrossAccountLeakUnderB,
  jsonResponse,
  readCurrentAccountId,
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

jest.mock('@features/profile/logic/legacyClear', () => ({
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
    if (cancelled.status === 'authenticated') {
      expect(cancelled.user.id).toBe(P2_USER_A.id);
    }
    expectLearnerDataIntact();
    await expectLearnerContextIsAccountA();
    await expectAccountBNotActive();
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
  let ctx: ReturnType<typeof setupP2RealInfraHarness>;

  beforeEach(() => {
    ctx = setupP2RealInfraHarness();
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

  it('P2-M-015-RECOVERY-CONFIRMED-RETRY / AC-015: restart after confirmed journal resumes retry wipe', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    const staged = await stageAwaitingAB();
    await confirmAccountSwitchAttempt(staged.attempt_id, {
      sourceAccountId: P2_USER_A.id,
      targetAccountId: P2_USER_B.id,
    });
    ctx.serverUser.current = P2_USER_A;
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v1/auth/me')) {
          return jsonResponse(200, {
            request_id: 'm-retry',
            status: 'success',
            user: P2_USER_A,
          });
        }
        return createP2FetchMock(ctx.serverUser)(url, init);
      },
    );
    resetBootStateForTests();
    resetAccountStoreForTests();
    await useAccountStore.getState().boot();
    const state = useAccountStore.getState();
    expect(state.phase).toBe('switch-confirmation');
    if (state.phase === 'switch-confirmation' && state.switchContext) {
      expect(state.switchContext.needsRetry).toBe(true);
      expect(state.switchContext.sourceAccountId).toBe(P2_USER_A.id);
      expect(state.switchContext.targetAccountId).toBe(P2_USER_B.id);
    }
    expectLearnerDataIntact();
    await expectLearnerContextIsAccountA();
  });

  it('P2-M-015-RECOVERY-CONFIRMED-ACTIVATE / AC-015: restart after pointer failure activates B', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    const staged = await stageAwaitingAB();
    jest.spyOn(authSession, 'activateStoredSession').mockResolvedValueOnce({
      ok: false,
      error: new Error('KEYCHAIN_ERROR'),
    });
    const failed = await confirmAccountSwitch(staged.attempt_id);
    expect(failed.status).toBe('failed');
    expectNoCrossAccountLeakUnderB();
    expect(readCurrentAccountId()).toBe(P2_USER_B.id);

    resetBootStateForTests();
    resetAccountStoreForTests();
    ctx.serverUser.current = P2_USER_B;
    await useAccountStore.getState().boot();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'authenticated',
      user: {id: P2_USER_B.id},
    });
    await expectLearnerContextIsAccountB();
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
    const stagedB = await stageAwaitingAB();
    const staleBAttemptId = stagedB.attempt_id;
    const replaced = await stageAccountSwitchAttempt({
      sourceAccountId: P2_USER_A.id,
      targetAccountId: P2_USER_C.id,
      targetSessionId: P2_SESSION_C.session_id,
      targetUserSnapshot: P2_USER_C,
    });
    expect(replaced.ok).toBe(true);
    if (replaced.ok) {
      expect(replaced.value.target_account_id).toBe(P2_USER_C.id);
      expect(replaced.value.attempt_id).not.toBe(staleBAttemptId);
    }
    const staleConfirm = await confirmAccountSwitch(staleBAttemptId);
    expect(staleConfirm.status).toBe('failed');
    if (staleConfirm.status === 'failed') {
      expect(staleConfirm.code).toBe('STALE_ATTEMPT_ID');
    }
    expectLearnerDataIntact();
    await expectLearnerContextIsAccountA();
    await expectAccountBNotActive();
    const journal = await readAccountSwitchJournal();
    expect(journal.ok && journal.value?.target_account_id).toBe(P2_USER_C.id);
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

  it('P2-M-DUP-DOUBLE-CONFIRM / AC-015: concurrent duplicate confirm yields one wipe', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    const staged = await stageAwaitingAB();
    const [first, second] = await Promise.all([
      confirmAccountSwitch(staged.attempt_id),
      confirmAccountSwitch(staged.attempt_id),
    ]);
    const outcomes = [first, second].map(r => r.status);
    expect(outcomes.every(s => s === 'authenticated')).toBe(true);
    expectNoCrossAccountLeakUnderB();
    await expectLearnerContextIsAccountB();
    const journal = await readAccountSwitchJournal();
    expect(journal).toEqual({ok: true, value: null});
  });

  it('P2-M-DUP-CONFIRM-RACE-STAGE / AC-015: confirm vs stage C settles without orphan wipe', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeP2LearnerData();
    await seedSession(P2_SESSION_B, P2_USER_B.id);
    await seedSession(P2_SESSION_C, P2_USER_C.id);
    const staged = await stageAwaitingAB();
    const bAttemptId = staged.attempt_id;
    const [confirmResult, stageResult] = await Promise.all([
      confirmAccountSwitch(bAttemptId),
      stageAccountSwitchAttempt({
        sourceAccountId: P2_USER_A.id,
        targetAccountId: P2_USER_C.id,
        targetSessionId: P2_SESSION_C.session_id,
        targetUserSnapshot: P2_USER_C,
      }),
    ]);
    const journal = await readAccountSwitchJournal();
    expect(journal.ok).toBe(true);
    if (!journal.ok || !journal.value) {
      throw new Error('expected journal');
    }
    if (journal.value.phase === 'confirmed') {
      expect(journal.value.attempt_id).toBe(bAttemptId);
      expect(journal.value.target_account_id).toBe(P2_USER_B.id);
      expect(confirmResult.status).toBe('authenticated');
      expect(stageResult.ok).toBe(false);
      if (!stageResult.ok) {
        expect(stageResult.errorCode).toBe('CONFIRMED_ATTEMPT_LOCKED');
      }
      expectNoCrossAccountLeakUnderB();
      await expectLearnerContextIsAccountB();
    } else {
      expect(journal.value.phase).toBe('awaiting');
      expect(journal.value.target_account_id).toBe(P2_USER_C.id);
      expect(stageResult.ok).toBe(true);
      expect(confirmResult.status).toBe('failed');
      expectLearnerDataIntact();
      await expectLearnerContextIsAccountA();
    }
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
