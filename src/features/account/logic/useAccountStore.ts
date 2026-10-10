import {create} from 'zustand';

import {
  type AuthUser,
  createAuthClient,
  signOut,
  terminalReset,
} from '@core/auth';
import {clearAllSessions, getActiveSession} from '@core/auth/sessionStore';

import {
  type AccountSwitchConfirmation,
  bootAccount,
  type BootResult,
  cancelAccountSwitch,
  confirmAccountSwitch,
  forgetRememberedUser,
  retryAccountSwitch,
  submitOnboardingName,
} from './accountBootstrap';

/**
 * Account bootstrap state for navigation gating (SETE-303 / T6).
 *
 * `phase` is the single source of truth the root navigator reads:
 * - `bootstrapping`: splash/loading — no account decision yet.
 * - `needs-onboarding`: bootstrap ticket held, display-name screen shown.
 * - `authenticated`: session persisted, main tabs shown.
 * - `signed-out`: explicit post-logout gate — stable, never auto-boots, and
 *   offers a Continue action that rejoins the normal boot path.
 * - `offline` / `merge-in-progress` / `failed`: explicit retry states, so a
 *   failed boot can never strand the app on the wrong stack.
 *
 * `offlineSession` marks an `authenticated` phase opened without reaching the
 * Server (docs/architecture/offline-mode.md #1); `revalidate` re-runs boot in
 * the background and only leaves the tabs when the Server decides so.
 *
 * The Zustand state only mirrors what Keychain/SQLite already persist — a
 * process restart re-runs `bootAccount`, which restores from the stored
 * session instead of trusting in-memory state.
 */

export type AccountPhase =
  | 'bootstrapping'
  | 'needs-onboarding'
  | 'authenticated'
  | 'signed-out'
  | 'switch-confirmation'
  | 'switching'
  | 'switch-failed'
  | 'offline'
  | 'merge-in-progress'
  | 'failed';

export type AccountState = {
  phase: AccountPhase;
  user: AuthUser | null;
  offlineSession: boolean;
  bootstrapTicket: string | null;
  bootstrapTicketExpiresAt: string | null;
  switchContext: AccountSwitchConfirmation | null;
  failureCode: string | null;
  failureMessage: string | null;
  /** `background`: keep the offline session unless the Server decides. */
  boot: (options?: {background?: boolean}) => Promise<void>;
  revalidate: () => Promise<void>;
  submitDisplayName: (
    displayName: string,
    phone?: string | null,
  ) => Promise<void>;
  confirmSwitch: () => Promise<void>;
  cancelSwitch: () => Promise<void>;
  retrySwitch: () => Promise<void>;
  retry: () => Promise<void>;
  signOutLocal: () => void;
  logout: () => Promise<void>;
};

function fromBootResult(result: BootResult): Partial<AccountState> {
  switch (result.status) {
    case 'authenticated':
      return {
        phase: 'authenticated',
        user: result.user,
        offlineSession: result.offline === true,
        bootstrapTicket: null,
        bootstrapTicketExpiresAt: null,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      };
    case 'needs-onboarding':
      return {
        phase: 'needs-onboarding',
        offlineSession: false,
        user: null,
        bootstrapTicket: result.bootstrapTicket,
        bootstrapTicketExpiresAt: result.bootstrapTicketExpiresAt,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      };
    case 'switch-confirmation':
      return {
        phase: 'switch-confirmation',
        offlineSession: false,
        user: result.switch.sourceUser,
        switchContext: result.switch,
        failureCode: null,
        failureMessage: null,
      };
    case 'switch-failed':
      return {
        phase: 'switch-failed',
        offlineSession: false,
        user: null,
        switchContext: null,
        failureCode: result.code,
        failureMessage: result.message,
      };
    case 'offline':
      return {
        phase: 'offline',
        offlineSession: false,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      };
    case 'merge-in-progress':
      return {
        phase: 'merge-in-progress',
        offlineSession: false,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      };
    case 'failed':
      return {
        phase: 'failed',
        offlineSession: false,
        switchContext: null,
        failureCode: result.code,
        failureMessage: result.message,
      };
  }
}

/**
 * A background revalidation leaves an offline session only on a decisive
 * answer (online account, onboarding, switch). Still offline, a transient
 * failure or a merge in progress keeps the learner where they are.
 */
function appliesOverOfflineSession(
  result: BootResult,
  state: AccountState,
): boolean {
  if (state.phase !== 'authenticated' || !state.offlineSession) {
    return false;
  }
  if (result.status === 'authenticated') {
    return result.offline !== true;
  }
  return (
    result.status !== 'offline' &&
    result.status !== 'failed' &&
    result.status !== 'merge-in-progress'
  );
}

/**
 * Shared in-flight store logout: concurrent `logout()` callers join one
 * server-then-local sign-out instead of racing two terminal resets.
 * Process-local like the boot/refresh guards; cleared on completion.
 */
let inFlightLogout: Promise<void> | null = null;

/**
 * CR-005 / AF-002 terminal-transition boundary (root-cause checkpoint §5.2).
 * `committedLogoutCount` increments only on successful logout commit.
 * Boots that start before a commit must not publish; stale runs re-clear
 * Keychain and register on `staleBootCleanup` so later boots (Continue) do
 * not join the stale `bootAccount` run.
 */
let committedLogoutCount = 0;
let keychainTouchedDuringLogout = false;
let staleBootCleanup: Promise<void> = Promise.resolve();
let logoutServerDone = false;
let inFlightStoreBoot: Promise<void> | null = null;

function localSignOut(): Promise<{ok: boolean}> {
  return signOut({client: createAuthClient()});
}

export const useAccountStore = create<AccountState>()((set, get) => ({
  phase: 'bootstrapping',
  user: null,
  offlineSession: false,
  bootstrapTicket: null,
  bootstrapTicketExpiresAt: null,
  switchContext: null,
  failureCode: null,
  failureMessage: null,

  boot: async ({background = false} = {}) => {
    const committedAtStart = committedLogoutCount;
    await staleBootCleanup;
    if (inFlightStoreBoot) {
      await inFlightStoreBoot;
    }
    const run = async (): Promise<void> => {
      const result = await bootAccount();
      if (inFlightLogout && logoutServerDone) {
        keychainTouchedDuringLogout = true;
        await inFlightLogout;
      }
      if (committedLogoutCount > committedAtStart) {
        const cleanup = localSignOut().then(() => {});
        staleBootCleanup = staleBootCleanup.then(() => cleanup);
        await cleanup;
        return;
      }
      if (background && !appliesOverOfflineSession(result, get())) {
        return;
      }
      set(fromBootResult(result));
    };
    const task = run();
    inFlightStoreBoot = task;
    try {
      await task;
    } finally {
      if (inFlightStoreBoot === task) {
        inFlightStoreBoot = null;
      }
    }
  },

  revalidate: async () => {
    const {phase, offlineSession} = get();
    if (phase !== 'authenticated' || !offlineSession || inFlightStoreBoot) {
      return;
    }
    await get().boot({background: true});
  },

  submitDisplayName: async (displayName, phone) => {
    const ticket = get().bootstrapTicket;
    if (!ticket) {
      set({
        phase: 'failed',
        failureCode: 'MISSING_BOOTSTRAP_TICKET',
        failureMessage: 'Signup session expired. Please restart the app.',
      });
      return;
    }
    const result = await submitOnboardingName(
      {bootstrapTicket: ticket, displayName, phone: phone ?? null},
      {},
    );
    if (
      result.status === 'authenticated' ||
      result.status === 'switch-confirmation' ||
      result.status === 'switch-failed'
    ) {
      set(fromBootResult(result));
      return;
    }
    if (result.status === 'offline') {
      set({
        phase: 'offline',
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      });
      return;
    }
    set({
      phase: 'failed',
      switchContext: null,
      failureCode: result.code,
      failureMessage: result.message,
    });
  },

  confirmSwitch: async () => {
    const ctx = get().switchContext;
    if (!ctx) {
      return;
    }
    set({phase: 'switching'});
    let result;
    try {
      result = await confirmAccountSwitch(ctx.attemptId);
    } catch {
      set({
        phase: 'switch-failed',
        failureCode: 'ACCOUNT_REPLACEMENT_FAILED',
        failureMessage: 'Account switch could not be completed.',
      });
      return;
    }
    if (result.status === 'authenticated') {
      set({
        phase: 'authenticated',
        user: result.user,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      });
      return;
    }
    set({
      phase: 'switch-failed',
      failureCode: result.code,
      failureMessage: 'Account switch could not be completed.',
    });
  },

  cancelSwitch: async () => {
    const ctx = get().switchContext;
    if (!ctx) {
      return;
    }
    set({phase: 'switching'});
    const result = await cancelAccountSwitch(ctx.attemptId);
    if (result.status === 'authenticated') {
      set({
        phase: 'authenticated',
        user: result.user,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      });
      return;
    }
    set({
      phase: 'switch-failed',
      failureCode: result.code,
      failureMessage: 'Could not cancel the account switch.',
    });
  },

  retrySwitch: async () => {
    const ctx = get().switchContext;
    if (!ctx) {
      return;
    }
    set({phase: 'switching'});
    let result;
    try {
      result = await retryAccountSwitch(ctx.attemptId);
    } catch {
      set({
        phase: 'switch-failed',
        failureCode: 'ACCOUNT_REPLACEMENT_FAILED',
        failureMessage: 'Account switch could not be completed.',
      });
      return;
    }
    if (result.status === 'authenticated') {
      set({
        phase: 'authenticated',
        user: result.user,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      });
      return;
    }
    set({
      phase: 'switch-failed',
      failureCode: result.code,
      failureMessage: 'Account switch could not be completed.',
    });
  },

  retry: async () => {
    set({phase: 'bootstrapping'});
    await get().boot();
  },

  signOutLocal: () => {
    set({
      phase: 'bootstrapping',
      user: null,
      offlineSession: false,
      bootstrapTicket: null,
      bootstrapTicketExpiresAt: null,
      switchContext: null,
      failureCode: null,
      failureMessage: null,
    });
  },

  logout: async () => {
    if (inFlightLogout) {
      await inFlightLogout;
      return;
    }
    const task = (async (): Promise<void> => {
      keychainTouchedDuringLogout = false;
      logoutServerDone = false;
      const client = createAuthClient();
      const stored = await getActiveSession();
      const accessToken = stored.ok ? stored.value?.access_token ?? null : null;
      try {
        await client.logout(accessToken);
      } catch {
        // Offline server logout must not block the local wipe (signOut parity).
      }
      logoutServerDone = true;
      const cleared = await clearAllSessions();
      if (!cleared.ok) {
        set({
          failureCode: 'KEYCHAIN_ERROR',
          failureMessage:
            'Could not sign out on this device. Please try again.',
        });
        return;
      }
      if (keychainTouchedDuringLogout) {
        const secondPass = await terminalReset({accessToken: null, client});
        if (!secondPass.cleared) {
          set({
            failureCode: 'KEYCHAIN_ERROR',
            failureMessage:
              'Could not sign out on this device. Please try again.',
          });
          return;
        }
      }
      forgetRememberedUser();
      committedLogoutCount += 1;
      set({
        phase: 'signed-out',
        user: null,
        offlineSession: false,
        bootstrapTicket: null,
        bootstrapTicketExpiresAt: null,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      });
    })();
    inFlightLogout = task;
    try {
      await task;
    } finally {
      if (inFlightLogout === task) {
        inFlightLogout = null;
      }
    }
  },
}));

/** Test seam: restores the store to its initial state between tests. */
export function resetAccountStoreForTests(): void {
  inFlightLogout = null;
  committedLogoutCount = 0;
  keychainTouchedDuringLogout = false;
  staleBootCleanup = Promise.resolve();
  logoutServerDone = false;
  inFlightStoreBoot = null;
  useAccountStore.setState({
    phase: 'bootstrapping',
    user: null,
    offlineSession: false,
    bootstrapTicket: null,
    bootstrapTicketExpiresAt: null,
    switchContext: null,
    failureCode: null,
    failureMessage: null,
  });
}
