import {Platform} from 'react-native';
import {createRequestId} from '../api/requestId';
import {getDatabase, wipeDatabase} from '../db/database';
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
  ensureValidSession,
  persistNewSession,
  terminalReset,
} from './authSession';
import {clearAllSessions} from './sessionStore';
import type {AuthUser} from './authTypes';

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

export type BootResult =
  | {status: 'authenticated'; user: AuthUser}
  | {
      status: 'needs-onboarding';
      bootstrapTicket: string;
      bootstrapTicketExpiresAt: string;
      identifier: DeviceIdentifier;
    }
  | {status: 'offline'}
  | {status: 'merge-in-progress'}
  | {status: 'failed'; code: string; message: string};

export type SubmitNameResult =
  | {status: 'authenticated'; user: AuthUser}
  | {status: 'offline'}
  | {status: 'failed'; code: string; message: string; retryable: boolean};

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
      return {status: 'authenticated', user: me.user};
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
    const persisted = await persistNewSession({
      session: bootstrapped.session,
      user: bootstrapped.user,
    });
    if (!persisted.ok) {
      return {
        status: 'failed',
        code: 'KEYCHAIN_ERROR',
        message: 'Secure storage is unavailable.',
      };
    }
    setInstallMarker();
    enforceAccountIsolation(bootstrapped.user.id);
    return {status: 'authenticated', user: bootstrapped.user};
  }

  setInstallMarker();
  return {
    status: 'needs-onboarding',
    bootstrapTicket: bootstrapped.bootstrap_ticket,
    bootstrapTicketExpiresAt: bootstrapped.bootstrap_ticket_expires_at,
    identifier,
  };
}

function enforceAccountIsolation(userId: string): void {
  const db = getDatabase();
  const current = readSetting('current_account_id');
  if (current && current !== userId) {
    wipeDatabase(db);
  }
  writeSetting('current_account_id', userId);
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
  const persisted = await persistNewSession({
    session: created.session,
    user: created.user,
  });
  if (!persisted.ok) {
    return {
      status: 'failed',
      code: 'KEYCHAIN_ERROR',
      message: 'Secure storage is unavailable.',
      retryable: true,
    };
  }
  clearSignupKey();
  setInstallMarker();
  enforceAccountIsolation(created.user.id);
  return {status: 'authenticated', user: created.user};
}
