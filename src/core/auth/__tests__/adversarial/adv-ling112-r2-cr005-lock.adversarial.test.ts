/**
 * LING-112 adversarial final lock r2 — CR-005 / AF-002 / INV-003.
 *
 * Locked regressions for the root-cause checkpoint §9
 * (`root-cause-checkpoint-LING-112-r1.md`), red on the reviewed test-only head
 * `06ab464b205f5c8cb6e41006d0711aa22cec75b3`:
 *
 * - LOCK-1 CR-005 rotated: a boot that finishes *inside* the logout window
 *   (after the active-pointer reset but before the commit) re-writes the
 *   Keychain with a distinct rotated session S2 and publishes `authenticated`;
 *   logout then commits `signed-out` but leaves the S2 pointer/blob behind, so
 *   the next cold boot restores A (logout lost).
 * - LOCK-2 CR-005 same-session: same window, boot rewrites S1 after the
 *   snapshot, leaving a dangling active pointer.
 * - LOCK-3 Continue: after logout resolves, `retry()` joins the stale
 *   `inFlightBoot` run and never issues a new authentication request, so the
 *   store ends `authenticated` on the session logout already sent to the server.
 *
 * Real SQLite + in-memory Keychain vault; only the fetch is doubled. Ordering
 * is forced with explicit barriers (Keychain and fetch), no timing sleeps.
 * ADV-001a/b (`adv-ling112-r1-cr001-af002.adversarial.test.ts`) stay unchanged
 * and are the r1 control.
 */
import {useAccountStore} from '@features/account/logic/useAccountStore';

import type {AuthSession} from '@core/auth/authTypes';
import {
  AUTH_ACTIVE_SESSION_SERVICE,
  AUTH_SESSION_SERVICE_PREFIX,
  getActiveSession,
  getActiveSessionId,
  listSessionIds,
} from '@core/auth/sessionStore';

import {
  bootStoreAuthenticated,
  createP2FetchMock,
  jsonResponse,
  P2_USER_A,
  seedActiveSessionA,
  seedInstall,
  setupP2RealInfraHarness,
  teardownP2RealInfraHarness,
} from '@test/support/realInfra/harness';

jest.mock('@features/account/logic/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

type KeychainMock = {
  resetGenericPassword: jest.Mock;
  setGenericPassword: jest.Mock;
  getGenericPassword: jest.Mock;
};

function keychain(): KeychainMock {
  return jest.requireMock('react-native-keychain') as KeychainMock;
}

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return {promise, resolve};
}

const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(resolve));

function rotatedSession(sessionId: string, accessToken: string): AuthSession {
  return {
    session_id: sessionId,
    access_token: accessToken,
    refresh_token: `${accessToken}_rt`,
    access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  };
}

const S2 = rotatedSession('88888888-8888-4888-8888-888888888888', 'lb_at_s2');

describe('ADV-LING-112-r2 / CR-005 / AF-002 / INV-003: boot inside the logout window', () => {
  let ctx: ReturnType<typeof setupP2RealInfraHarness>;

  beforeEach(() => {
    ctx = setupP2RealInfraHarness();
  });

  afterEach(() => {
    teardownP2RealInfraHarness();
  });

  function recordPhases(): {phases: string[]; stop: () => void} {
    const phases: string[] = [];
    const stop = useAccountStore.subscribe(state => {
      phases.push(state.phase);
    });
    return {phases, stop};
  }

  function pauseLogoutAfterPointerReset(): {
    paused: Promise<void>;
    release: () => void;
  } {
    const Keychain = keychain();
    const realReset = Keychain.resetGenericPassword.getMockImplementation()!;
    const paused = deferred();
    const release = deferred();
    let pausedOnce = false;
    Keychain.resetGenericPassword.mockImplementation(
      async (options: {service?: string}) => {
        if (
          !pausedOnce &&
          typeof options?.service === 'string' &&
          options.service.startsWith(AUTH_SESSION_SERVICE_PREFIX)
        ) {
          pausedOnce = true;
          paused.resolve();
          await release.promise;
        }
        return realReset(options);
      },
    );
    return {paused: paused.promise, release: release.resolve};
  }

  function barrierOnActivePointerWrite(): {written: Promise<void>} {
    const Keychain = keychain();
    const realSet = Keychain.setGenericPassword.getMockImplementation()!;
    const written = deferred();
    Keychain.setGenericPassword.mockImplementation(
      async (
        username: string,
        password: string,
        options: {service?: string},
      ) => {
        const result = await realSet(username, password, options);
        if (options?.service === AUTH_ACTIVE_SESSION_SERVICE) {
          written.resolve();
        }
        return result;
      },
    );
    return {written: written.promise};
  }

  async function expectSignedOutClean(): Promise<void> {
    expect(useAccountStore.getState().phase).toBe('signed-out');
    expect(useAccountStore.getState().user).toBeNull();
    await expect(getActiveSessionId()).resolves.toEqual({
      ok: true,
      value: null,
    });
    await expect(getActiveSession()).resolves.toEqual({
      ok: true,
      value: null,
    });
    await expect(listSessionIds()).resolves.toEqual({ok: true, value: []});
  }

  it('LOCK-1 / CR-005 / AF-002 / INV-003: distinct rotated session finishing inside the logout window', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    await bootStoreAuthenticated();

    const realMock = createP2FetchMock(ctx.serverUser);
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v1/auth/bootstrap')) {
          return jsonResponse(200, {
            request_id: 'b2',
            status: 'authenticated',
            user: P2_USER_A,
            session: S2,
          });
        }
        if (url.endsWith('/v1/auth/logout')) {
          return jsonResponse(200, {status: 'success'});
        }
        return realMock(url, init);
      },
    );

    const {phases, stop} = recordPhases();
    try {
      const logoutGate = pauseLogoutAfterPointerReset();
      const pointerGate = barrierOnActivePointerWrite();

      const logoutPromise = useAccountStore.getState().logout();
      await logoutGate.paused;

      // Boot starts after the pointer reset but before logout commits. Do not
      // await it: after the fix it waits for logout (R1) and would deadlock.
      const bootPromise = useAccountStore.getState().boot();
      await pointerGate.written;
      await flushMicrotasks();

      logoutGate.release();
      await logoutPromise;

      await expectSignedOutClean();

      await bootPromise;
      await expectSignedOutClean();

      expect(phases).not.toContain('authenticated');
    } finally {
      stop();
    }
  });

  it('LOCK-2 / CR-005 / AF-002 / INV-003: same-session restore finishing inside the logout window', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    await bootStoreAuthenticated();

    const realMock = createP2FetchMock(ctx.serverUser);
    const bootParked = deferred();
    const releaseBoot = deferred();
    let parked = false;
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v1/me') && !parked) {
          parked = true;
          bootParked.resolve();
          await releaseBoot.promise;
        }
        return realMock(url, init);
      },
    );

    const {phases, stop} = recordPhases();
    try {
      const bootPromise = useAccountStore.getState().boot();
      await bootParked.promise;

      const logoutGate = pauseLogoutAfterPointerReset();
      const pointerGate = barrierOnActivePointerWrite();
      const logoutPromise = useAccountStore.getState().logout();
      await logoutGate.paused;

      releaseBoot.resolve();
      await pointerGate.written;
      await flushMicrotasks();

      logoutGate.release();
      await logoutPromise;

      await expectSignedOutClean();

      await bootPromise;
      await expectSignedOutClean();

      expect(phases).not.toContain('authenticated');
    } finally {
      stop();
    }
  });

  it('LOCK-3 / CR-005 / INV-GAP / AF-002: post-logout Continue must run a fresh authentication', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    await bootStoreAuthenticated();

    const realMock = createP2FetchMock(ctx.serverUser);
    const urls: string[] = [];
    const bootParked = deferred();
    const releaseBoot = deferred();
    let parked = false;
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        urls.push(String(url));
        if (url.endsWith('/v1/me') && !parked) {
          parked = true;
          bootParked.resolve();
          await releaseBoot.promise;
        }
        if (url.endsWith('/v1/auth/bootstrap')) {
          return jsonResponse(200, {
            request_id: 'b3',
            status: 'authenticated',
            user: P2_USER_A,
            session: S2,
          });
        }
        return realMock(url, init);
      },
    );

    const bootPromise = useAccountStore.getState().boot();
    await bootParked.promise;

    await useAccountStore.getState().logout();
    expect(useAccountStore.getState().phase).toBe('signed-out');

    const continuePromise = useAccountStore.getState().retry();
    await flushMicrotasks();
    releaseBoot.resolve();
    await Promise.all([bootPromise, continuePromise]);

    const logoutIndex = urls.findIndex(url => url.endsWith('/v1/auth/logout'));
    expect(logoutIndex).toBeGreaterThanOrEqual(0);
    const afterLogout = urls.slice(logoutIndex + 1);
    expect(
      afterLogout.some(
        url => url.endsWith('/v1/auth/bootstrap') || url.endsWith('/v1/me'),
      ),
    ).toBe(true);

    expect(useAccountStore.getState().phase).toBe('authenticated');
    const active = await getActiveSession();
    expect(active.ok).toBe(true);
    if (active.ok) {
      expect(active.value).not.toBeNull();
      expect(active.value?.session_id).toBe(S2.session_id);
    }
    const pointer = await getActiveSessionId();
    expect(pointer).toEqual({ok: true, value: S2.session_id});
  });

  it('CTL / CR-005 control: a boot finishing before the snapshot is cleared by logout', async () => {
    await seedActiveSessionA();
    seedInstall(P2_USER_A.id);
    await bootStoreAuthenticated();

    const realMock = createP2FetchMock(ctx.serverUser);
    const logoutParked = deferred();
    const releaseLogout = deferred();
    let paused = false;
    ctx.mockFetch.mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (url.endsWith('/v1/auth/logout') && !paused) {
          paused = true;
          logoutParked.resolve();
          await releaseLogout.promise;
        }
        if (url.endsWith('/v1/auth/bootstrap')) {
          return jsonResponse(200, {
            request_id: 'b-ctl',
            status: 'authenticated',
            user: P2_USER_A,
            session: S2,
          });
        }
        return realMock(url, init);
      },
    );

    const logoutPromise = useAccountStore.getState().logout();
    await logoutParked.promise;

    // Boot runs to completion before the snapshot.
    await useAccountStore.getState().boot();

    releaseLogout.resolve();
    await logoutPromise;

    await expectSignedOutClean();
  });
});
