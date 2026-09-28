import type {
  AuthClientError,
  AuthHttpClient,
  AuthTransportError,
} from './authClient';
import {isAuthApiError} from './authClient';
import type {AuthSession, AuthUser} from './authTypes';
import {
  clearAllSessions,
  deleteSession,
  getActiveSession,
  saveSession,
  setActiveSessionId,
} from './sessionStore';

/**
 * Authenticated session lifecycle (SETE-303 / T6): serialized refresh and
 * terminal reset.
 *
 * - Refresh is serialized per process: concurrent callers share the single
 *   in-flight rotation instead of racing two rotations (the loser would hit
 *   SESSION_REPLAYED and nuke a healthy family).
 * - SESSION_REPLAYED, or an active session the server no longer knows
 *   (INVALID_SESSION on refresh), triggers a terminal reset: every stored
 *   session is cleared and the caller must re-bootstrap from the device
 *   identifier. A replayed family is never retried — replay means the
 *   refresh token was already consumed.
 */

export type EnsureSessionResult =
  | {status: 'valid'; session: AuthSession; userId: string}
  | {status: 'no-session'}
  | {status: 'reset'; reason: string}
  | {status: 'refresh-failed'; code: string; message: string}
  | {status: 'offline'; error: AuthTransportError}
  | {status: 'keychain-error'; error: unknown};

/** Access tokens count as expired 60s early to absorb clock skew. */
export const ACCESS_TOKEN_SKEW_MARGIN_MS = 60_000;

export function isAccessTokenExpired(
  session: AuthSession,
  now: number = Date.now(),
): boolean {
  const expiresAt = Date.parse(session.access_expires_at);
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return expiresAt - ACCESS_TOKEN_SKEW_MARGIN_MS <= now;
}

let inFlightRefresh: Promise<EnsureSessionResult> | null = null;

/** Test seam: drops the shared in-flight refresh promise. */
export function resetRefreshStateForTests(): void {
  inFlightRefresh = null;
}

function isTerminalRefreshError(error: AuthClientError): boolean {
  return (
    isAuthApiError(error) &&
    (error.code === 'SESSION_REPLAYED' ||
      error.code === 'INVALID_SESSION' ||
      error.code === 'TOKEN_EXPIRED')
  );
}

/** Best-effort server logout, then wipe every stored session. */
export async function terminalReset(input: {
  accessToken: string | null;
  client: AuthHttpClient;
}): Promise<{cleared: boolean; error?: unknown}> {
  try {
    await input.client.logout(input.accessToken);
  } catch {
    // Offline or server failure must not block the local wipe: a replayed
    // or unknown session is untrustworthy regardless of what the server
    // says. Logout is idempotent, so a missed call is harmless.
  }
  const cleared = await clearAllSessions();
  if (!cleared.ok) {
    return {cleared: false, error: cleared.error};
  }
  return {cleared: true};
}

async function runRefresh(input: {
  client: AuthHttpClient;
  session: AuthSession;
  userId: string;
}): Promise<EnsureSessionResult> {
  const {client, session, userId} = input;
  let rotated;
  try {
    rotated = await client.refresh(session.refresh_token);
  } catch (error) {
    const clientError = error as AuthClientError;
    if (!isAuthApiError(clientError)) {
      return {status: 'offline', error: clientError as AuthTransportError};
    }
    if (isTerminalRefreshError(clientError)) {
      await terminalReset({accessToken: session.access_token, client});
      return {status: 'reset', reason: clientError.code};
    }
    // Non-terminal API failure (rate limit, 5xx, validation): the stored
    // session is untouched so the caller can retry. Even with an expired
    // access token this is not a reset — wiping on a transient failure
    // would destroy a healthy family.
    return {
      status: 'refresh-failed',
      code: clientError.code,
      message: clientError.message,
    };
  }
  const next: AuthSession = rotated.session;
  const saved = await saveSession({
    ...next,
    user_id: userId,
    stored_at: new Date().toISOString(),
  });
  if (!saved.ok) {
    return {status: 'keychain-error', error: saved.error};
  }
  const pointed = await setActiveSessionId(next.session_id);
  if (!pointed.ok) {
    return {status: 'keychain-error', error: pointed.error};
  }
  // Rotation succeeded: the old session id is dead server-side, so drop
  // its record. Best-effort — a leftover record is ignored by readers and
  // removed by the next terminal reset.
  if (next.session_id !== session.session_id) {
    await deleteSession(session.session_id);
  }
  return {status: 'valid', session: next, userId};
}

/**
 * Returns a usable session, rotating the refresh token when the access
 * token is expired. Concurrent callers share one rotation.
 */
export function ensureValidSession(input: {
  forceRefresh?: boolean;
  client: AuthHttpClient;
  now?: number;
}): Promise<EnsureSessionResult> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  const task = (async (): Promise<EnsureSessionResult> => {
    const stored = await getActiveSession();
    if (!stored.ok) {
      return {status: 'keychain-error', error: stored.error};
    }
    if (!stored.value) {
      return {status: 'no-session'};
    }
    const {user_id: userId, ...session} = stored.value;
    if (!input.forceRefresh && !isAccessTokenExpired(session, input.now)) {
      return {status: 'valid', session, userId};
    }
    return runRefresh({client: input.client, session, userId});
  })();
  inFlightRefresh = task;
  const clearInFlight = () => {
    if (inFlightRefresh === task) {
      inFlightRefresh = null;
    }
  };
  task.then(clearInFlight, clearInFlight);
  return task;
}

/**
 * Persists a candidate session without moving the active pointer (P2 A→B
 * staging). Tokens stay in Keychain but are not active until confirmation.
 */
export async function saveCandidateSession(input: {
  session: AuthSession;
  user: AuthUser;
}): Promise<{ok: true} | {ok: false; error: unknown}> {
  const saved = await saveSession({
    ...input.session,
    user_id: input.user.id,
    stored_at: new Date().toISOString(),
  });
  if (!saved.ok) {
    return {ok: false, error: saved.error};
  }
  return {ok: true};
}

/** Moves the active-session pointer to an already persisted session id. */
export async function activateStoredSession(
  sessionId: string,
): Promise<{ok: true} | {ok: false; error: unknown}> {
  const pointed = await setActiveSessionId(sessionId);
  if (!pointed.ok) {
    return {ok: false, error: pointed.error};
  }
  return {ok: true};
}

/**
 * Persists a freshly issued session (bootstrap / account creation) and
 * marks it active. Returns the user so callers can hydrate account state.
 */
export async function persistNewSession(input: {
  session: AuthSession;
  user: AuthUser;
}): Promise<{ok: true} | {ok: false; error: unknown}> {
  const saved = await saveCandidateSession(input);
  if (!saved.ok) {
    return saved;
  }
  return activateStoredSession(input.session.session_id);
}

/** Signs out: best-effort server logout, then clears every stored session. */
export async function signOut(input: {
  client: AuthHttpClient;
}): Promise<{ok: true} | {ok: false; error: unknown}> {
  const stored = await getActiveSession();
  const accessToken = stored.ok ? stored.value?.access_token ?? null : null;
  const result = await terminalReset({accessToken, client: input.client});
  return result.cleared ? {ok: true} : {ok: false, error: result.error};
}
