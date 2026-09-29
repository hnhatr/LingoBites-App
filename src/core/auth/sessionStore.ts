import * as Keychain from 'react-native-keychain';
import type {AuthSession} from './authTypes';

/**
 * Account-neutral, enumerable Keychain session store (SETE-303 / T6).
 *
 * - Account-neutral: every session lives under its own service
 *   (`com.lingobites.auth.session.<session_id>`), keyed by session id —
 *   never by user/account id. Reinstall, fallback-account and merge flows
 *   change which account is active, so cleanup and rotation must keep
 *   working without knowing any account id.
 * - Enumerable: `listSessionIds` uses `getAllGenericPasswordServices` and
 *   filters by the session prefix, so `clearAllSessions` (fresh-install
 *   cleanup, terminal reset) can find every stored session even when the
 *   active-session pointer is missing or stale.
 * - The active-session pointer is a separate fixed-service credential whose
 *   password is the active session id. A missing pointer means "no active
 *   session" — orphaned session records are ignored by readers and removed
 *   by the next `clearAllSessions`.
 *
 * Plaintext tokens are shown here only in memory; Keychain holds them
 * encrypted at rest and only SHA-256 hashes ever reach the backend (T1).
 */

export const AUTH_SESSION_SERVICE_PREFIX = 'com.lingobites.auth.session.';
export const AUTH_ACTIVE_SESSION_SERVICE = 'com.lingobites.auth.active';
const SESSION_USERNAME = 'auth-session';
const ACTIVE_USERNAME = 'active-session';

export type StoredSession = AuthSession & {
  user_id: string;
  stored_at: string;
};

export type SessionStoreResult<T> =
  | {ok: true; value: T}
  | {ok: false; errorCode: 'KEYCHAIN_ERROR'; error: unknown};

function serviceFor(sessionId: string): string {
  return `${AUTH_SESSION_SERVICE_PREFIX}${sessionId}`;
}

function toStoredSession(record: StoredSession): string {
  return JSON.stringify(record);
}

function parseStoredSession(raw: string): StoredSession | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.session_id !== 'string' ||
      typeof parsed.access_token !== 'string' ||
      typeof parsed.refresh_token !== 'string' ||
      typeof parsed.access_expires_at !== 'string' ||
      typeof parsed.refresh_expires_at !== 'string' ||
      typeof parsed.user_id !== 'string'
    ) {
      return null;
    }
    return {
      session_id: parsed.session_id,
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      access_expires_at: parsed.access_expires_at,
      refresh_expires_at: parsed.refresh_expires_at,
      user_id: parsed.user_id,
      stored_at:
        typeof parsed.stored_at === 'string'
          ? parsed.stored_at
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Persists a session record under its own account-neutral service. */
export async function saveSession(
  record: StoredSession,
): Promise<SessionStoreResult<void>> {
  try {
    await Keychain.setGenericPassword(
      SESSION_USERNAME,
      toStoredSession(record),
      {service: serviceFor(record.session_id)},
    );
    return {ok: true, value: undefined};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

/** Marks a session id as the active session. */
export async function setActiveSessionId(
  sessionId: string | null,
): Promise<SessionStoreResult<void>> {
  try {
    if (sessionId === null) {
      await Keychain.resetGenericPassword({
        service: AUTH_ACTIVE_SESSION_SERVICE,
      });
      return {ok: true, value: undefined};
    }
    await Keychain.setGenericPassword(ACTIVE_USERNAME, sessionId, {
      service: AUTH_ACTIVE_SESSION_SERVICE,
    });
    return {ok: true, value: undefined};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

async function readCredential(
  service: string,
): Promise<{username: string; password: string} | null> {
  const credentials = await Keychain.getGenericPassword({service});
  return credentials === false ? null : credentials;
}

/** Reads the active session id pointer, or null when no session is active. */
export async function getActiveSessionId(): Promise<
  SessionStoreResult<string | null>
> {
  try {
    const credentials = await readCredential(AUTH_ACTIVE_SESSION_SERVICE);
    if (!credentials || credentials.password.length === 0) {
      return {ok: true, value: null};
    }
    return {ok: true, value: credentials.password};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

/** Reads one stored session by its id, or null when absent/corrupt. */
export async function getSession(
  sessionId: string,
): Promise<SessionStoreResult<StoredSession | null>> {
  try {
    const credentials = await readCredential(serviceFor(sessionId));
    if (!credentials) {
      return {ok: true, value: null};
    }
    return {ok: true, value: parseStoredSession(credentials.password)};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

/** Reads the active session record, or null when none is active. */
export async function getActiveSession(): Promise<
  SessionStoreResult<StoredSession | null>
> {
  const active = await getActiveSessionId();
  if (!active.ok) {
    return active;
  }
  if (active.value === null) {
    return {ok: true, value: null};
  }
  return getSession(active.value);
}

/** Lists every stored auth session id by enumerating Keychain services. */
export async function listSessionIds(): Promise<SessionStoreResult<string[]>> {
  try {
    const services = await Keychain.getAllGenericPasswordServices();
    return {
      ok: true,
      value: services
        .filter(service => service.startsWith(AUTH_SESSION_SERVICE_PREFIX))
        .map(service => service.slice(AUTH_SESSION_SERVICE_PREFIX.length))
        .filter(sessionId => sessionId.length > 0),
    };
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

/** Deletes one stored session record (not the active pointer). */
export async function deleteSession(
  sessionId: string,
): Promise<SessionStoreResult<void>> {
  try {
    await Keychain.resetGenericPassword({service: serviceFor(sessionId)});
    return {ok: true, value: undefined};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

/**
 * Terminal reset: removes the active-session pointer and every stored auth
 * session. Used for fresh-install cleanup (Keychain survives uninstall on
 * iOS) and for SESSION_REPLAYED, where the whole token family is revoked
 * server-side and no stored session is trustworthy anymore.
 */
export async function clearAllSessions(): Promise<
  SessionStoreResult<{clearedSessionIds: string[]}>
> {
  const listed = await listSessionIds();
  if (!listed.ok) {
    return listed;
  }
  try {
    await Keychain.resetGenericPassword({
      service: AUTH_ACTIVE_SESSION_SERVICE,
    });
    for (const sessionId of listed.value) {
      await Keychain.resetGenericPassword({service: serviceFor(sessionId)});
    }
    return {ok: true, value: {clearedSessionIds: listed.value}};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}
