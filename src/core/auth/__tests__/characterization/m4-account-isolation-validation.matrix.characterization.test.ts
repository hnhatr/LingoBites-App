import {accountGateRouteForPhase} from '@app/navigation/accountGate';

import type {AccountPhase} from '@features/account';
import {resetBootStateForTests} from '@features/account/logic/accountBootstrap';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '@features/account/logic/useAccountStore';

import {createAuthClient} from '@core/auth';
import {ensureValidSession} from '@core/auth/authSession';

import {
  countAudioAssetRows,
  expectM4RelocatedDomainCleared,
  expectM4YoutubeRowPresent,
  expectPersistedSessionRestoreBoot,
  fetchUrlPaths,
  seedExpiredActiveSessionA,
  setupM4AccountIsolationHarness,
  teardownM4AccountIsolationHarness,
  writeM4RelocatedDomainLearnerData,
} from '@test/support/accountIsolation/harness';
import {
  expectAccountBNotActive,
  expectLearnerContextIsAccountA,
  P2_SESSION_B,
  P2_USER_A,
  P2_USER_B,
  seedActiveSessionA,
  seedInstall,
  seedSession,
  stageAwaitingAB,
  writeP2LearnerData,
} from '@test/support/realInfra/harness';

jest.mock('@features/account/logic/legacyClear', () => ({
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

    it('M4-M-BOOT-SESSION-RESTORE / INV-003: boot restores via /v1/me without bootstrap', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      ctx.mockFetch.mockClear();
      await useAccountStore.getState().boot();
      expect(useAccountStore.getState().phase).toBe('authenticated');
      expectPersistedSessionRestoreBoot(ctx.mockFetch);
    });

    it('M4-M-RESTART-AWAITING / AC-015: cold boot after awaiting journal prompts without wiping A', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await stageAwaitingAB();
      resetBootStateForTests();
      resetAccountStoreForTests();
      ctx.mockFetch.mockClear();
      await useAccountStore.getState().boot();
      expect(useAccountStore.getState().phase).toBe('switch-confirmation');
      expectM4YoutubeRowPresent();
      await expectLearnerContextIsAccountA();
      const paths = fetchUrlPaths(ctx.mockFetch);
      expect(paths.some(path => path.endsWith('/v1/auth/bootstrap'))).toBe(
        false,
      );
    });

    it('M4-M-REFRESH-EXPIRED-AWAITING / INV-003: refresh with expired token while awaiting keeps A active', async () => {
      await seedExpiredActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await stageAwaitingAB();
      ctx.mockFetch.mockClear();
      const client = createAuthClient({
        fetchImpl: ctx.mockFetch as typeof fetch,
        baseUrl: 'http://test',
      });
      const refreshed = await ensureValidSession({
        client,
        forceRefresh: true,
      });
      expect(refreshed.status).toBe('valid');
      const paths = fetchUrlPaths(ctx.mockFetch);
      expect(paths.some(path => path.endsWith('/v1/auth/refresh'))).toBe(true);
      if (refreshed.status === 'valid') {
        expect(refreshed.userId).toBe(P2_USER_A.id);
      }
      expectM4YoutubeRowPresent();
      await expectAccountBNotActive();
    });

    it('M4-M-REFRESH-CONFIRM-INTERLEAVE / INV-003: refresh ∥ confirmSwitch does not activate B before wipe completes', async () => {
      await seedExpiredActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      await seedSession(P2_SESSION_B, P2_USER_B.id);
      ctx.serverUser.current = P2_USER_B;
      await useAccountStore.getState().boot();
      expect(useAccountStore.getState().phase).toBe('switch-confirmation');
      const client = createAuthClient({
        fetchImpl: ctx.mockFetch as typeof fetch,
        baseUrl: 'http://test',
      });
      await Promise.all([
        ensureValidSession({client, forceRefresh: true}),
        useAccountStore.getState().confirmSwitch(),
      ]);
      const phase = useAccountStore.getState().phase;
      expect(phase === 'authenticated' || phase === 'switch-failed').toBe(true);
      if (phase === 'authenticated') {
        expect(useAccountStore.getState().user?.id).toBe(P2_USER_B.id);
        expectM4RelocatedDomainCleared();
      }
    });

    it('M4-M-DOMAIN-AUDIO / TASK-012: audio_assets cleared after confirmed A→B', async () => {
      await seedActiveSessionA();
      seedInstall(P2_USER_A.id);
      writeM4RelocatedDomainLearnerData();
      expect(countAudioAssetRows()).toBeGreaterThan(0);
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
      expectM4YoutubeRowPresent();
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
      expect(countAudioAssetRows()).toBeGreaterThan(0);
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
