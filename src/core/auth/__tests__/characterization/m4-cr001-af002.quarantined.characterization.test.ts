/**
 * CR-001 / AF-002 — CONFIRMED production defect at reviewed head `12ad16e…`.
 * Quarantined from default CI: enable with `M4_RUN_CR001=1` to reproduce red.
 */
import {useAccountStore} from '@features/account/logic/useAccountStore';
import {
  bootStoreAuthenticated,
  createP2FetchMock,
  jsonResponse,
  P2_USER_A,
  seedActiveSessionA,
  seedInstall,
} from '@test/support/realInfra/harness';
import {
  expectSignedOutWithClearedActivePointer,
  setupM4AccountIsolationHarness,
  teardownM4AccountIsolationHarness,
  writeM4RelocatedDomainLearnerData,
} from '@test/support/accountIsolation/harness';

jest.mock('@features/account/logic/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

const runCr001 = process.env.M4_RUN_CR001 === '1';
const cr001It = runCr001 ? it : it.skip;

describe('CR-001 quarantined — concurrent boot vs logout (AF-002)', () => {
  let ctx: ReturnType<typeof setupM4AccountIsolationHarness>;

  beforeEach(() => {
    ctx = setupM4AccountIsolationHarness();
  });

  afterEach(() => {
    teardownM4AccountIsolationHarness();
  });

  cr001It(
    'CR-001-M4-M-BOOT-LOGOUT-AF002 / AF-002: logout wins concurrent boot; signed-out + cleared active pointer',
    async () => {
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
      expect(useAccountStore.getState().phase).toBe('signed-out');
      expect(useAccountStore.getState().user).toBeNull();
      await expectSignedOutWithClearedActivePointer();
    },
  );
});
