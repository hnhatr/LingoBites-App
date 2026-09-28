import {create} from 'zustand';
import {
  bootAccount,
  cancelAccountSwitch,
  confirmAccountSwitch,
  createAuthClient,
  retryAccountSwitch,
  signOut,
  submitOnboardingName,
  type AccountSwitchConfirmation,
  type AuthUser,
  type BootResult,
} from '@shared/auth';

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
  bootstrapTicket: string | null;
  bootstrapTicketExpiresAt: string | null;
  switchContext: AccountSwitchConfirmation | null;
  failureCode: string | null;
  failureMessage: string | null;
  boot: () => Promise<void>;
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
        bootstrapTicket: null,
        bootstrapTicketExpiresAt: null,
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      };
    case 'needs-onboarding':
      return {
        phase: 'needs-onboarding',
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
        user: result.switch.sourceUser,
        switchContext: result.switch,
        failureCode: null,
        failureMessage: null,
      };
    case 'switch-failed':
      return {
        phase: 'switch-failed',
        user: null,
        switchContext: null,
        failureCode: result.code,
        failureMessage: result.message,
      };
    case 'offline':
      return {
        phase: 'offline',
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      };
    case 'merge-in-progress':
      return {
        phase: 'merge-in-progress',
        switchContext: null,
        failureCode: null,
        failureMessage: null,
      };
    case 'failed':
      return {
        phase: 'failed',
        switchContext: null,
        failureCode: result.code,
        failureMessage: result.message,
      };
  }
}

/**
 * Shared in-flight store logout: concurrent `logout()` callers join one
 * server-then-local sign-out instead of racing two terminal resets.
 * Process-local like the boot/refresh guards; cleared on completion.
 */
let inFlightLogout: Promise<void> | null = null;

export const useAccountStore = create<AccountState>()((set, get) => ({
  phase: 'bootstrapping',
  user: null,
  bootstrapTicket: null,
  bootstrapTicketExpiresAt: null,
  switchContext: null,
  failureCode: null,
  failureMessage: null,

  boot: async () => {
    const result = await bootAccount();
    set(fromBootResult(result));
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
    const result = await confirmAccountSwitch(ctx.attemptId);
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
    const result = await retryAccountSwitch(ctx.attemptId);
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
      // Best-effort server logout, then local secure-storage wipe — the
      // shared lifecycle. An offline/server failure with a successful local
      // wipe still reaches `signed-out`; only a local Keychain failure
      // keeps the current phase and reports instead of claiming logout.
      const result = await signOut({client: createAuthClient()});
      if (!result.ok) {
        set({
          failureCode: 'KEYCHAIN_ERROR',
          failureMessage:
            'Could not sign out on this device. Please try again.',
        });
        return;
      }
      set({
        phase: 'signed-out',
        user: null,
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
  useAccountStore.setState({
    phase: 'bootstrapping',
    user: null,
    bootstrapTicket: null,
    bootstrapTicketExpiresAt: null,
    switchContext: null,
    failureCode: null,
    failureMessage: null,
  });
}
