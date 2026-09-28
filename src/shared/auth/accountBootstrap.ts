import {Platform} from 'react-native';
import {createRequestId} from '../api/requestId';
import {
  executeAccountReplacementTransaction,
  getDatabase,
} from '../db/database';
import {
  canonicalizeIdentifier,
  resolveDeviceIdentifier,
  type DeviceIdentifier,
} from '../identity/deviceIdentifier';
import {readPlatformIdentifiers} from '../identity/deviceIdentityNative';
import {hasInstallMarker, setInstallMarker} from '../db/installMarker';
import {
  createAuthClient,
  isAuthApiError,
  type AuthClientError,
  type AuthHttpClient,
} from './authClient';
import {
  activateStoredSession,
  ensureValidSession,
  persistNewSession,
  saveCandidateSession,
  terminalReset,
} from './authSession';
import {
  cancelAccountSwitchAttempt,
  confirmAccountSwitchAttempt,
  readCurrentAccountSwitchAttempt,
  recoverAccountSwitchAttempt,
  stageAccountSwitchAttempt,
  type CoordinatorErrorCode,
} from './accountSwitchCoordinator';
import type {AccountSwitchAttemptV1} from './accountSwitchJournal';
import {clearAccountSwitchJournal} from './accountSwitchJournal';
import {
  clearAllSessions,
  deleteSession,
  getActiveSession,
} from './sessionStore';
import type {AuthSession, AuthUser} from './authTypes';

/**
 * Bootstrap/onboarding state machine (SETE-303 / T6).
 *
 * Boot is idempotent and deterministic:
 *
 * 1. Concurrent `bootAccount` calls share one in-flight run — the app can
 *    never create two accounts from a double render or a retry tap.
 * 2. A missing SQLite install marker means this install has no local state.
 *    Keychain survives uninstall on iOS, so persisted sessions are cleared
 *    *before* any fallback identifier is minted — a stale pre-uninstall
 *    session must never be restored as the current account.
 * 3. The random fallback UUID is persisted in SQLite once per install and
 *    reused across boots of the same install, so killing the app mid-flow
 *    does not mint a new fallback identity (and a new account) every launch.
 * 4. Account creation sends a persisted `Idempotency-Key`: a retry after a
 *    crash or an offline blip replays the same signup instead of creating a
 *    duplicate. A 409 conflict re-bootstraps once to converge on the
 *    already-created account.
 */

export const FALLBACK_DEVICE_ID_KEY = 'account.fallback_device_id';
export const SIGNUP_IDEMPOTENCY_KEY = 'account.signup_idempotency_key';

export type AccountSwitchConfirmation = {
  attemptId: string;
  sourceAccountId: string;
  targetAccountId: string;
  sourceUser: AuthUser;
  targetUser: AuthUser;
  /** Confirmed journal with DB still on source — user must retry the wipe. */
  needsRetry: boolean;
};

export type BootResult =
  | {status: 'authenticated'; user: AuthUser}
  | {
      status: 'needs-onboarding';
      bootstrapTicket: string;
      bootstrapTicketExpiresAt: string;
      identifier: DeviceIdentifier;
    }
  | {status: 'switch-confirmation'; switch: AccountSwitchConfirmation}
  | {status: 'switch-failed'; code: string; message: string}
  | {status: 'offline'}
  | {status: 'merge-in-progress'}
  | {status: 'failed'; code: string; message: string};

export type SubmitNameResult =
  | {status: 'authenticated'; user: AuthUser}
  | {status: 'switch-confirmation'; switch: AccountSwitchConfirmation}
  | {status: 'switch-failed'; code: string; message: string}
  | {status: 'offline'}
  | {status: 'failed'; code: string; message: string; retryable: boolean};

export type AccountSwitchActionResult =
  | {status: 'authenticated'; user: AuthUser}
  | {status: 'failed'; code: string; message: string};

export type BootDeps = {
  platform?: 'android' | 'ios';
  client?: AuthHttpClient;
  randomUuid?: () => string;
  canonicalCleanupAuthRef?: string;
};

function readSetting(key: string): string | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
    [key],
  );
  const row = result.rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, value, now],
  );
}

function deleteSetting(key: string): void {
  const db = getDatabase();
  db.execute('DELETE FROM app_settings WHERE key = ?;', [key]);
}

let inFlightBoot: Promise<BootResult> | null = null;

/** Test seam: drops the shared in-flight boot promise. */
export function resetBootStateForTests(): void {
  inFlightBoot = null;
}

function toFailed(error: AuthClientError): BootResult {
  if (!isAuthApiError(error)) {
    return {status: 'offline'};
  }
  return {status: 'failed', code: error.code, message: error.message};
}

async function resolveIdentifierForBoot(
  platform: 'android' | 'ios',
  randomUuid: () => string,
): Promise<DeviceIdentifier> {
  const raw = await readPlatformIdentifiers();
  const {identifier, fromFallback} = resolveDeviceIdentifier(platform, raw, {
    randomUuid,
  });
  if (!fromFallback) {
    return identifier;
  }
  // Same-install stability: reuse the persisted fallback instead of minting
  // a new identity on every boot.
  try {
    const persisted = readSetting(FALLBACK_DEVICE_ID_KEY);
    const canonicalPersisted = persisted
      ? canonicalizeIdentifier('random_fallback', persisted)
      : null;
    if (canonicalPersisted) {
      return {kind: 'random_fallback', value: canonicalPersisted};
    }
    writeSetting(FALLBACK_DEVICE_ID_KEY, identifier.value);
  } catch {
    // SQLite unavailable: use the freshly minted fallback for this run
    // only. Next boot repeats cleanup + re-bootstrap, which the server
    // resolves without duplicating the platform-identified account.
  }
  return identifier;
}

/**
 * Runs the boot sequence: fresh-install cleanup, session restore, then
 * device-identifier bootstrap. Resolves to `authenticated` when the device
 * already has an account, or `needs-onboarding` with a bootstrap ticket.
 */
export function bootAccount(deps: BootDeps = {}): Promise<BootResult> {
  if (inFlightBoot) {
    return inFlightBoot;
  }
  const task = runBoot(deps);
  inFlightBoot = task;
  const clearInFlight = () => {
    if (inFlightBoot === task) {
      inFlightBoot = null;
    }
  };
  task.then(clearInFlight, clearInFlight);
  return task;
}

import {
  executeLegacyClear,
  executeCanonicalLegacyClear,
} from '../db/legacyClear';

async function runBoot(deps: BootDeps): Promise<BootResult> {
  const platform =
    deps.platform ?? (Platform.OS === 'android' ? 'android' : 'ios');
  const client = deps.client ?? createAuthClient();
  const randomUuid = deps.randomUuid ?? createRequestId;

  if (deps.canonicalCleanupAuthRef) {
    await executeCanonicalLegacyClear({
      authorizationRef: deps.canonicalCleanupAuthRef,
    });
  }

  // Checkpoint A quarantine: the generic boot clear must not delete v1/v2
  // lesson rows or lesson tokens before the parity gate. Only the gated
  // canonical cleanup (marker `lesson.canonical_legacy_clear_v1`) may do so.
  await executeLegacyClear();

  const recoveryBoot = await runAccountSwitchRecoveryBoot(client);
  if (recoveryBoot !== null) {
    return recoveryBoot;
  }

  if (!hasInstallMarker()) {
    // Fresh install (or wiped SQLite): Keychain may still hold a
    // pre-uninstall session. Clear first so it can never be restored as
    // this install's account, then proceed to bootstrap.
    await clearAllSessions();
  }

  // A marker-present install may hold a live session: validate/rotate it
  // and hydrate the user before touching the network bootstrap.
  const ensured = await ensureValidSession({client});
  if (ensured.status === 'valid') {
    try {
      const me = await client.me(ensured.session.access_token);
      setInstallMarker();
      return applyAuthenticatedSession({
        session: ensured.session,
        user: me.user,
      });
    } catch (error) {
      const clientError = error as AuthClientError;
      if (!isAuthApiError(clientError)) {
        return {status: 'offline'};
      }
      if (clientError.code === 'MERGE_IN_PROGRESS' || clientError.retryable) {
        return {status: 'merge-in-progress'};
      }
      // Unknown/expired session server-side: drop everything and fall
      // through to device bootstrap so the account is recovered by locator.
      await terminalReset({
        accessToken: ensured.session.access_token,
        client,
      });
    }
  } else if (ensured.status === 'reset') {
    // Terminal refresh state already wiped local sessions; fall through to
    // device bootstrap to recover the account by locator.
  } else if (ensured.status === 'offline') {
    return {status: 'offline'};
  } else if (ensured.status === 'refresh-failed') {
    return {
      status: 'failed',
      code: ensured.code,
      message: ensured.message,
    };
  } else if (ensured.status === 'keychain-error') {
    return {
      status: 'failed',
      code: 'KEYCHAIN_ERROR',
      message: 'Secure storage is unavailable.',
    };
  }

  const identifier = await resolveIdentifierForBoot(platform, randomUuid);
  let bootstrapped;
  try {
    bootstrapped = await client.bootstrap({
      identifier_kind: identifier.kind,
      identifier_value: identifier.value,
    });
  } catch (error) {
    return toFailed(error as AuthClientError);
  }

  if (bootstrapped.status === 'authenticated') {
    setInstallMarker();
    return applyAuthenticatedSession({
      session: bootstrapped.session,
      user: bootstrapped.user,
    });
  }

  setInstallMarker();
  return {
    status: 'needs-onboarding',
    bootstrapTicket: bootstrapped.bootstrap_ticket,
    bootstrapTicketExpiresAt: bootstrapped.bootstrap_ticket_expires_at,
    identifier,
  };
}

function resolveSourceAccountId(activeUserId: string | null): string | null {
  const current = readSetting('current_account_id');
  if (current) {
    return current;
  }
  return activeUserId;
}

function switchFailed(
  code: string,
  message = 'Account switch could not be completed.',
): BootResult {
  return {status: 'switch-failed', code, message};
}

function coordinatorSwitchFailed(code: CoordinatorErrorCode): BootResult {
  return switchFailed(code);
}

function confirmationFromAttempt(
  attempt: AccountSwitchAttemptV1,
  sourceUser: AuthUser,
  needsRetry: boolean,
): BootResult {
  return {
    status: 'switch-confirmation',
    switch: {
      attemptId: attempt.attempt_id,
      sourceAccountId: attempt.source_account_id,
      targetAccountId: attempt.target_account_id,
      sourceUser,
      targetUser: attempt.target_user_snapshot,
      needsRetry,
    },
  };
}

async function resolveSourceUserForAttempt(
  client: AuthHttpClient,
  attempt: AccountSwitchAttemptV1,
): Promise<{ok: true; user: AuthUser} | {ok: false; boot: BootResult}> {
  const active = await getActiveSession();
  if (!active.ok) {
    return {
      ok: false,
      boot: {
        status: 'failed',
        code: 'KEYCHAIN_ERROR',
        message: 'Secure storage is unavailable.',
      },
    };
  }
  if (active.value && active.value.user_id === attempt.source_account_id) {
    try {
      const me = await client.me(active.value.access_token);
      return {ok: true, user: me.user};
    } catch {
      // Fall through to minimal placeholder below.
    }
  }
  return {
    ok: true,
    user: {
      id: attempt.source_account_id,
      public_code: '',
      display_name: '',
      phone_e164: null,
      status: 'active',
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  };
}

async function runAccountSwitchRecoveryBoot(
  client: AuthHttpClient,
): Promise<BootResult | null> {
  const localAccountId = readSetting('current_account_id');
  const activeStored = await getActiveSession();
  if (!activeStored.ok) {
    return {
      status: 'failed',
      code: 'KEYCHAIN_ERROR',
      message: 'Secure storage is unavailable.',
    };
  }
  const activeSessionUserId = activeStored.value?.user_id ?? null;

  const attemptRead = await readCurrentAccountSwitchAttempt();
  if (!attemptRead.ok) {
    return coordinatorSwitchFailed(attemptRead.errorCode);
  }

  let dbCommittedToTarget = false;
  if (attemptRead.value !== null) {
    dbCommittedToTarget =
      localAccountId !== null &&
      localAccountId === attemptRead.value.target_account_id;
  }

  const recovery = await recoverAccountSwitchAttempt({
    localAccountId,
    activeSessionUserId,
    dbCommittedToTarget,
  });
  if (!recovery.ok) {
    return coordinatorSwitchFailed(recovery.errorCode);
  }

  switch (recovery.value.kind) {
    case 'none':
    case 'cleared_stale_journal':
      return null;
    case 'invalid_journal':
      return switchFailed(recovery.value.errorCode);
    case 'confirmed_activate': {
      const activated = await activateStoredSession(
        recovery.value.attempt.target_session_id,
      );
      if (!activated.ok) {
        return {
          status: 'failed',
          code: 'KEYCHAIN_ERROR',
          message: 'Secure storage is unavailable.',
        };
      }
      await clearAccountSwitchJournal();
      setInstallMarker();
      return {
        status: 'authenticated',
        user: recovery.value.attempt.target_user_snapshot,
      };
    }
    case 'awaiting_confirmation':
    case 'confirmed_retry_wipe': {
      const sourceUser = await resolveSourceUserForAttempt(
        client,
        recovery.value.attempt,
      );
      if (!sourceUser.ok) {
        return sourceUser.boot;
      }
      return confirmationFromAttempt(
        recovery.value.attempt,
        sourceUser.user,
        recovery.value.kind === 'confirmed_retry_wipe',
      );
    }
    default:
      return null;
  }
}

async function beginAccountSwitch(input: {
  session: AuthSession;
  user: AuthUser;
  sourceAccountId: string;
  sourceUser: AuthUser;
}): Promise<BootResult> {
  const saved = await saveCandidateSession({
    session: input.session,
    user: input.user,
  });
  if (!saved.ok) {
    return {
      status: 'failed',
      code: 'KEYCHAIN_ERROR',
      message: 'Secure storage is unavailable.',
    };
  }

  const staged = await stageAccountSwitchAttempt({
    sourceAccountId: input.sourceAccountId,
    targetAccountId: input.user.id,
    targetSessionId: input.session.session_id,
    targetUserSnapshot: input.user,
  });
  if (!staged.ok) {
    await deleteSession(input.session.session_id);
    return coordinatorSwitchFailed(staged.errorCode);
  }

  return confirmationFromAttempt(staged.value, input.sourceUser, false);
}

function applyAuthenticatedSession(input: {
  session: AuthSession;
  user: AuthUser;
  sourceUser?: AuthUser;
}): BootResult | Promise<BootResult> {
  const activeUserId = input.sourceUser?.id ?? null;
  const sourceAccountId = resolveSourceAccountId(activeUserId);
  if (sourceAccountId && sourceAccountId !== input.user.id) {
    const sourceUser =
      input.sourceUser ??
      ({
        id: sourceAccountId,
        public_code: '',
        display_name: '',
        phone_e164: null,
        status: 'active',
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      } satisfies AuthUser);
    return beginAccountSwitch({
      session: input.session,
      user: input.user,
      sourceAccountId,
      sourceUser,
    });
  }

  return (async (): Promise<BootResult> => {
    const persisted = await persistNewSession({
      session: input.session,
      user: input.user,
    });
    if (!persisted.ok) {
      return {
        status: 'failed',
        code: 'KEYCHAIN_ERROR',
        message: 'Secure storage is unavailable.',
      };
    }
    writeSetting('current_account_id', input.user.id);
    return {status: 'authenticated', user: input.user};
  })();
}

/** Confirms the staged attempt, replaces SQLite, then activates B. */
export async function confirmAccountSwitch(
  attemptId: string,
): Promise<AccountSwitchActionResult> {
  const current = await readCurrentAccountSwitchAttempt();
  if (!current.ok) {
    return {status: 'failed', code: current.errorCode, message: ''};
  }
  if (current.value === null) {
    return {status: 'failed', code: 'NO_ACTIVE_ATTEMPT', message: ''};
  }
  const attempt = current.value;
  const confirmed = await confirmAccountSwitchAttempt(attemptId, {
    sourceAccountId: attempt.source_account_id,
    targetAccountId: attempt.target_account_id,
  });
  if (!confirmed.ok) {
    return {status: 'failed', code: confirmed.errorCode, message: ''};
  }

  const db = getDatabase();
  try {
    executeAccountReplacementTransaction(db, attempt.target_account_id);
  } catch {
    return {
      status: 'failed',
      code: 'ACCOUNT_REPLACEMENT_FAILED',
      message: 'Local data could not be replaced for the new account.',
    };
  }

  const activated = await activateStoredSession(attempt.target_session_id);
  if (!activated.ok) {
    return {
      status: 'failed',
      code: 'KEYCHAIN_ERROR',
      message: 'Secure storage is unavailable.',
    };
  }

  const cleared = await clearAccountSwitchJournal();
  if (!cleared.ok) {
    return {status: 'failed', code: cleared.errorCode, message: ''};
  }

  writeSetting('current_account_id', attempt.target_account_id);
  setInstallMarker();
  return {status: 'authenticated', user: attempt.target_user_snapshot};
}

/** Retries the DB replacement for a journal already in `confirmed` phase. */
export async function retryAccountSwitch(
  attemptId: string,
): Promise<AccountSwitchActionResult> {
  const current = await readCurrentAccountSwitchAttempt();
  if (!current.ok || current.value === null) {
    return {
      status: 'failed',
      code: current.ok ? 'NO_ACTIVE_ATTEMPT' : current.errorCode,
      message: '',
    };
  }
  if (
    current.value.attempt_id !== attemptId ||
    current.value.phase !== 'confirmed'
  ) {
    return {status: 'failed', code: 'STALE_ATTEMPT_ID', message: ''};
  }
  const attempt = current.value;
  const db = getDatabase();
  try {
    executeAccountReplacementTransaction(db, attempt.target_account_id);
  } catch {
    return {
      status: 'failed',
      code: 'ACCOUNT_REPLACEMENT_FAILED',
      message: 'Local data could not be replaced for the new account.',
    };
  }
  const activated = await activateStoredSession(attempt.target_session_id);
  if (!activated.ok) {
    return {
      status: 'failed',
      code: 'KEYCHAIN_ERROR',
      message: 'Secure storage is unavailable.',
    };
  }
  await clearAccountSwitchJournal();
  writeSetting('current_account_id', attempt.target_account_id);
  setInstallMarker();
  return {status: 'authenticated', user: attempt.target_user_snapshot};
}

/** Cancels an awaiting attempt and drops the staged candidate session. */
export async function cancelAccountSwitch(
  attemptId: string,
  deps: BootDeps = {},
): Promise<AccountSwitchActionResult> {
  const client = deps.client ?? createAuthClient();
  const current = await readCurrentAccountSwitchAttempt();
  if (!current.ok || current.value === null) {
    return {
      status: 'failed',
      code: current.ok ? 'NO_ACTIVE_ATTEMPT' : current.errorCode,
      message: '',
    };
  }
  const attempt = current.value;
  const cancelled = await cancelAccountSwitchAttempt(attemptId);
  if (!cancelled.ok) {
    return {status: 'failed', code: cancelled.errorCode, message: ''};
  }
  await deleteSession(attempt.target_session_id);

  const active = await getActiveSession();
  if (!active.ok || !active.value) {
    return {
      status: 'failed',
      code: 'NO_ACTIVE_SESSION',
      message: 'No active session to restore.',
    };
  }
  if (active.value.user_id !== attempt.source_account_id) {
    return {
      status: 'failed',
      code: 'OWNERSHIP_MISMATCH',
      message: 'Could not restore the previous account.',
    };
  }
  try {
    const me = await client.me(active.value.access_token);
    return {status: 'authenticated', user: me.user};
  } catch {
    return {
      status: 'authenticated',
      user: {
        id: attempt.source_account_id,
        public_code: '',
        display_name: '',
        phone_e164: null,
        status: 'active',
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
    };
  }
}

function getOrCreateSignupKey(): string {
  try {
    const existing = readSetting(SIGNUP_IDEMPOTENCY_KEY);
    if (existing) {
      return existing;
    }
    const key = createRequestId();
    writeSetting(SIGNUP_IDEMPOTENCY_KEY, key);
    return key;
  } catch {
    return createRequestId();
  }
}

function clearSignupKey(): void {
  try {
    deleteSetting(SIGNUP_IDEMPOTENCY_KEY);
  } catch {
    // Best-effort: a leftover key only matters if the same ticket is
    // reused, and tickets are single-use.
  }
}

/**
 * Creates the account for a `needs-onboarding` ticket with the required
 * display name. The persisted idempotency key makes retries replay; a 409
 * conflict re-bootstraps once to converge on the already-created account.
 */
export async function submitOnboardingName(
  input: {
    bootstrapTicket: string;
    displayName: string;
    phone?: string | null;
  },
  deps: BootDeps = {},
): Promise<SubmitNameResult> {
  const client = deps.client ?? createAuthClient();
  const idempotencyKey = getOrCreateSignupKey();
  let created;
  try {
    created = await client.createUser({
      bootstrapTicket: input.bootstrapTicket,
      displayName: input.displayName,
      phone: input.phone ?? null,
      idempotencyKey,
    });
  } catch (error) {
    const clientError = error as AuthClientError;
    if (!isAuthApiError(clientError)) {
      return {status: 'offline'};
    }
    if (clientError.code === 'IDEMPOTENCY_CONFLICT') {
      // Same key, different payload — or a won race. Re-bootstrap to
      // converge on the existing account instead of minting another.
      clearSignupKey();
      const rebooted = await bootAccount(deps);
      if (rebooted.status === 'authenticated') {
        return {status: 'authenticated', user: rebooted.user};
      }
      if (rebooted.status === 'switch-confirmation') {
        return rebooted;
      }
      if (rebooted.status === 'switch-failed') {
        return rebooted;
      }
      if (rebooted.status === 'offline') {
        return {status: 'offline'};
      }
      return {
        status: 'failed',
        code: rebooted.status === 'failed' ? rebooted.code : 'BOOTSTRAP_FAILED',
        message:
          rebooted.status === 'failed'
            ? rebooted.message
            : 'Account creation conflicted. Please try again.',
        retryable: true,
      };
    }
    return {
      status: 'failed',
      code: clientError.code,
      message: clientError.message,
      retryable: clientError.retryable,
    };
  }
  const applied = await applyAuthenticatedSession({
    session: created.session,
    user: created.user,
  });
  if (
    applied.status === 'authenticated' ||
    applied.status === 'switch-confirmation'
  ) {
    clearSignupKey();
    setInstallMarker();
    return applied;
  }
  if (applied.status === 'switch-failed') {
    return applied;
  }
  return {
    status: 'failed',
    code: applied.status === 'failed' ? applied.code : 'BOOTSTRAP_FAILED',
    message:
      applied.status === 'failed' ? applied.message : 'Account setup failed.',
    retryable: true,
  };
}
