import type {AccountPhase} from '@modules/account';
import {
  useAccountStore,
  resetAccountStoreForTests,
} from '@modules/account/useAccountStore';
import {accountGateRouteForPhase} from '@/app/navigation/accountGate';
import {createAuthClient} from '@shared/auth';
import {resetBootStateForTests} from '@shared/auth/accountBootstrap';
import {ensureValidSession} from '@shared/auth/authSession';
import {
  bootStoreAuthenticated,
  createP2FetchMock,
  expectAccountBNotActive,
  expectLearnerContextIsAccountA,
  jsonResponse,
  P2_SESSION_B,
  P2_USER_A,
  P2_USER_B,
  seedActiveSessionA,
  seedInstall,
  seedSession,
  stageAwaitingAB,
  writeP2LearnerData,
} from '@/test-support/p2RealInfra/harness';
import {
  expectM4RelocatedDomainCleared,
  expectM4YoutubeRowPresent,
  setupM4AccountIsolationHarness,
  teardownM4AccountIsolationHarness,
  writeM4RelocatedDomainLearnerData,
} from '@/test-support/m4AccountIsolation/harness';

jest.mock('@shared/db/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

const ALL_ACCOUNT_PHASES: AccountPhase[] = [
  'authenticated',
  'needs-onboarding',
  'signed-out',
  'bootstrapping',
  'offline',
  'failed',
  'switch-confirmation',
  'switching',
  'switch-failed',
  'merge-in-progress',
];

describe('LING-112 TASK-006 M4 account-isolation matrix', () => {
  describe('navigation / provider mount (INV-004, AC-007)', () => {
    it('M4-M-INV004-TABS-GATE / AC-007: Tabs mount only when authenticated', () => {
      for (const phase of ALL_ACCOUNT_PHASES) {
        const route = accountGateRouteForPhase(phase);
        if (phase === 'authenticated') {
          expect(route).toBe('Tabs');
        } else {
          expect(route).not.toBe('Tabs');
        }
      }
    });

    it('M4-M-INV004-SWITCH-ROUTES / INV-004: P2 switch phases use AccountSwitch gate', () => {
      expect(accountGateRouteForPhase('switch-confirmation')).toBe(
        'AccountSwitch',
      );
      expect(accountGateRouteForPhase('switching')).toBe('AccountSwitch');
      expect(accountGateRouteForPhase('switch-failed')).toBe('AccountSwitch');
    });
  });

  describe('real-sqlite + keychain vault interleavings', () => {
    let ctx: ReturnType<typeof setupM4AccountIsolationHarness>;

    beforeEach(() => {
      ctx = setupM4AccountIsolationHarness();
    });

    afterEach(() => {
      teardownM4AccountIsolationHarness();
    });

    it('M4-M-BOOT-LOGOUT-RACE / INV-003: concurrent boot + logout leaves a single terminal state and retains A rows', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await bootStoreAuthenticated();
      ctx.mockFetch.mockImplementation(
        async (url: string, init?: RequestInit) => {
          if (url.endsWith('/v1/auth/logout')) {
            return jsonResponse(200, {status: 'success'});
          }
          return createP2FetchMock(ctx.serverUser)(url, init);
        },
      );
      await Promise.all([
        useAccountStore.getState().boot(),
        useAccountStore.getState().logout(),
      ]);
      const phase = useAccountStore.getState().phase;
      expect(phase === 'signed-out' || phase === 'authenticated').toBe(true);
      expectM4YoutubeRowPresent();
    });

    it('M4-M-RESTART-AWAITING / AC-015: cold boot after awaiting journal prompts without wiping A', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await stageAwaitingAB();
      resetBootStateForTests();
      resetAccountStoreForTests();
      await useAccountStore.getState().boot();
      expect(useAccountStore.getState().phase).toBe('switch-confirmation');
      expectM4YoutubeRowPresent();
      await expectLearnerContextIsAccountA();
    });

    it('M4-M-REFRESH-AWAITING / AC-009: refresh while awaiting keeps A active', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await stageAwaitingAB();
      const client = createAuthClient({
        fetchImpl: ctx.mockFetch as typeof fetch,
        baseUrl: 'http://test',
      });
      const refreshed = await ensureValidSession({client});
      expect(refreshed.status).toBe('valid');
      if (refreshed.status === 'valid') {
        expect(refreshed.userId).toBe(P2_USER_A.id);
      }
      expectM4YoutubeRowPresent();
      await expectAccountBNotActive();
    });

    it('M4-M-DOMAIN-AUDIO / TASK-012: audio_assets cleared after confirmed A→B', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await seedSession(P2_SESSION_B, P2_USER_B.id);
      ctx.serverUser.current = P2_USER_B;
      await useAccountStore.getState().boot();
      await useAccountStore.getState().confirmSwitch();
      expect(useAccountStore.getState().user?.id).toBe(P2_USER_B.id);
      expectM4RelocatedDomainCleared();
    });

    it('M4-M-DOMAIN-YOUTUBE / TASK-015: youtube_progress cleared after confirmed A→B', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeP2LearnerData();
      await seedSession(P2_SESSION_B, P2_USER_B.id);
      ctx.serverUser.current = P2_USER_B;
      await useAccountStore.getState().boot();
      await useAccountStore.getState().confirmSwitch();
      expectM4RelocatedDomainCleared();
    });

    it('M4-M-P2-REGRESSION-SMOKE / AC-008: post-M3 confirm path still prevents cross-account leak', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await seedSession(P2_SESSION_B, P2_USER_B.id);
      ctx.serverUser.current = P2_USER_B;
      await useAccountStore.getState().boot();
      await useAccountStore.getState().confirmSwitch();
      expect(useAccountStore.getState()).toMatchObject({
        phase: 'authenticated',
        user: {id: P2_USER_B.id},
      });
      expectM4RelocatedDomainCleared();
    });
  });
});
