/**
 * LING-112 adversarial review r1 — CR-001 / AF-002 / INV-003.
 *
 * Locked regression for the confirmed production defect on the reviewed
 * test-only head `242a22856ecc9630a98fd3e920357f4d43ce2664`:
 * after an explicit `logout()` resolves, a concurrent/stale `boot()` that was
 * already in flight re-bootstraps and reactivates account A instead of leaving
 * the app in the `signed-out` phase with a cleared active-session pointer.
 *
 * Real SQLite + in-memory Keychain vault are used; only the network (fetch) is
 * doubled. Ordering is forced with explicit deterministic barriers around the
 * logout clear and the stale boot activation, so the failure is not timing
 * dependent.
 */
import {useAccountStore} from '@features/account/logic/useAccountStore';
import {
  bootStoreAuthenticated,
  createP2FetchMock,
  jsonResponse,
  P2_USER_A,
  seedActiveSessionA,
  seedInstall,
} from '@/test-support/p2RealInfra/harness';
import {
  expectSignedOutWithClearedActivePointer,
  setupM4AccountIsolationHarness,
  teardownM4AccountIsolationHarness,
  writeM4RelocatedDomainLearnerData,
} from '@/test-support/m4AccountIsolation/harness';
import {
  AUTH_ACTIVE_SESSION_SERVICE,
  getActiveSession,
} from '@core/auth/sessionStore';

jest.mock('@features/profile/logic/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return {promise, resolve};
}

describe('ADV-001 / CR-001 / AF-002 / INV-003: stale boot vs explicit logout', () => {
  let ctx: ReturnType<typeof setupM4AccountIsolationHarness>;

  beforeEach(() => {
    ctx = setupM4AccountIsolationHarness();
  });

  afterEach(() => {
    teardownM4AccountIsolationHarness();
  });

  async function seedAuthenticatedA(): Promise<void> {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    writeM4RelocatedDomainLearnerData();
    await bootStoreAuthenticated();
  }

  async function expectLogoutWins(): Promise<void> {
    expect(useAccountStore.getState().phase).toBe('signed-out');
    expect(useAccountStore.getState().user).toBeNull();
    await expectSignedOutWithClearedActivePointer();
    await expect(getActiveSession()).resolves.toEqual({ok: true, value: null});
  }

  it('ADV-001a / CR-001 / AF-002 / INV-003: a boot parked while A is active must not reactivate A after logout resolves', async () => {
    await seedAuthenticatedA();

    const realMock = createP2FetchMock(ctx.serverUser);
    const bootFetch = deferred();
    const releaseBootFetch = deferred();
    let bootFetchSeen = false;

    // Barrier: hold the stale boot at its terminal session fetch, so the only
    // way it can finish is *after* logout has fully resolved.
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v1/auth/logout')) {
          return jsonResponse(200, {status: 'success'});
        }
        if (
          !bootFetchSeen &&
          (url.endsWith('/v1/me') ||
            url.endsWith('/v1/auth/me') ||
            url.endsWith('/v1/auth/bootstrap'))
        ) {
          bootFetchSeen = true;
          bootFetch.resolve();
          await releaseBootFetch.promise;
        }
        return realMock(url, init);
      },
    );

    const staleBoot = useAccountStore.getState().boot();
    await bootFetch.promise;
    expect(bootFetchSeen).toBe(true);

    // Logout runs to completion while the stale boot is still parked.
    await useAccountStore.getState().logout();
    await expectLogoutWins();

    // Let the stale boot finish; the explicit logout must still win.
    releaseBootFetch.resolve();
    await staleBoot;
    await expectLogoutWins();
  });

  it('ADV-001b / CR-001 / AF-002 / INV-003: a boot started while logout is in flight must not win over the resolved logout', async () => {
    await seedAuthenticatedA();

    const realMock = createP2FetchMock(ctx.serverUser);
    const bootFetch = deferred();
    const releaseBootFetch = deferred();
    const logoutClearReached = deferred();
    const releaseLogoutClear = deferred();
    let bootFetchSeen = false;

    // Barrier 1: pause logout at its local Keychain clear, before it can wipe
    // the active pointer.
    const Keychain = jest.requireMock('react-native-keychain') as any;
    const realReset = Keychain.resetGenericPassword.getMockImplementation();
    let logoutClearPaused = false;
    Keychain.resetGenericPassword.mockImplementation(
      async (options: {service?: string}) => {
        if (
          !logoutClearPaused &&
          options?.service === AUTH_ACTIVE_SESSION_SERVICE
        ) {
          logoutClearPaused = true;
          logoutClearReached.resolve();
          await releaseLogoutClear.promise;
        }
        return realReset(options);
      },
    );

    // Barrier 2: pause the concurrently started stale boot at its terminal
    // session fetch.
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v1/auth/logout')) {
          return jsonResponse(200, {status: 'success'});
        }
        if (
          !bootFetchSeen &&
          (url.endsWith('/v1/me') ||
            url.endsWith('/v1/auth/me') ||
            url.endsWith('/v1/auth/bootstrap'))
        ) {
          bootFetchSeen = true;
          bootFetch.resolve();
          await releaseBootFetch.promise;
        }
        return realMock(url, init);
      },
    );

    const logoutPromise = useAccountStore.getState().logout();
    await logoutClearReached.promise;

    // The pointer is still A here, so this boot takes the persisted-session
    // restore path and parks at its terminal fetch.
    const staleBoot = useAccountStore.getState().boot();
    await bootFetch.promise;
    expect(bootFetchSeen).toBe(true);

    // Logout resolves first.
    releaseLogoutClear.resolve();
    await logoutPromise;
    await expectLogoutWins();

    // The stale boot may now finish; the resolved logout must still win.
    releaseBootFetch.resolve();
    await staleBoot;
    await expectLogoutWins();
  });
});
