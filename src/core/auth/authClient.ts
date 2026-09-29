import {getAppConfig} from '../api/appConfig';
import {createRequestId} from '../api/requestId';
import type {
  ApiErrorBody,
  AuthSession,
  AuthUser,
  BootstrapAuthenticatedBody,
  BootstrapIdentifierBody,
  BootstrapTicketBody,
  CreateUserBody,
  LogoutBody,
  MeBody,
  RefreshBody,
} from './authTypes';

export type AuthApiError = {
  kind: 'api_error';
  httpStatus: number;
  code: string;
  message: string;
  retryable: boolean;
};

export type AuthTransportError =
  | {kind: 'offline'; message: string; cause: unknown}
  | {kind: 'invalid_response'; message: string; httpStatus: number};

export type AuthClientError = AuthApiError | AuthTransportError;

export function isAuthApiError(error: AuthClientError): error is AuthApiError {
  return error.kind === 'api_error';
}

/**
 * Typed account/auth HTTP client (SETE-303 / T6) against the frozen T1
 * routes: bootstrap, users, refresh, logout, me.
 *
 * - Transport failures (DNS, airplane mode, connection reset) surface as
 *   `offline` — never as an API code — so the state machine can retry
 *   without creating duplicate accounts.
 * - Every response is parsed defensively: a 2xx body without the expected
 *   shape is `invalid_response`, not a silent success.
 * - Account creation always sends an `Idempotency-Key`. The key is generated
 *   per signup attempt by the caller (the bootstrap orchestrator persists it
 *   across retries of the same attempt) so a retried POST replays instead of
 *   creating a duplicate.
 */
export type AuthHttpClient = {
  bootstrap: (
    body: BootstrapIdentifierBody,
  ) => Promise<BootstrapAuthenticatedBody | BootstrapTicketBody>;
  createUser: (input: {
    bootstrapTicket: string;
    displayName: string;
    phone?: string | null;
    idempotencyKey: string;
  }) => Promise<CreateUserBody>;
  refresh: (refreshToken: string) => Promise<RefreshBody>;
  logout: (accessToken: string | null) => Promise<LogoutBody>;
  me: (accessToken: string) => Promise<MeBody>;
  updateMe: (input: {
    accessToken: string;
    displayName?: string;
    phone?: string | null;
  }) => Promise<MeBody>;
};

export type AuthClientDeps = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

function readErrorBody(data: unknown): ApiErrorBody | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const body = data as Record<string, unknown>;
  const error = body.error as Record<string, unknown> | undefined;
  if (typeof error?.code !== 'string' || typeof error?.message !== 'string') {
    return null;
  }
  return {
    request_id: typeof body.request_id === 'string' ? body.request_id : '',
    status: 'failed',
    error: {code: error.code, message: error.message},
    ...(typeof body.retryable === 'boolean' ? {retryable: body.retryable} : {}),
  };
}

function toAuthError(httpStatus: number, data: unknown): AuthClientError {
  const parsed = readErrorBody(data);
  return {
    kind: 'api_error',
    httpStatus,
    code: parsed?.error.code ?? `HTTP_${httpStatus}`,
    message: parsed?.error.message ?? `Request failed (${httpStatus}).`,
    retryable: parsed?.retryable ?? (httpStatus === 429 || httpStatus >= 500),
  };
}

function requireString(value: unknown): value is string {
  return typeof value === 'string';
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const user = value as Record<string, unknown>;
  return (
    requireString(user.id) &&
    requireString(user.public_code) &&
    requireString(user.display_name) &&
    (requireString(user.phone_e164) || user.phone_e164 === null) &&
    (user.status === 'active' || user.status === 'merging') &&
    requireString(user.created_at) &&
    requireString(user.updated_at)
  );
}

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const session = value as Record<string, unknown>;
  return (
    requireString(session.session_id) &&
    requireString(session.access_token) &&
    requireString(session.refresh_token) &&
    requireString(session.access_expires_at) &&
    requireString(session.refresh_expires_at)
  );
}

async function postJson<T>(
  fetchImpl: typeof fetch,
  baseUrl: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
  validate: (data: unknown) => data is T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...headers},
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw {
      kind: 'offline',
      message: 'Network unavailable.',
      cause,
    } satisfies AuthTransportError;
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw toAuthError(response.status, data);
  }
  if (!validate(data)) {
    throw {
      kind: 'invalid_response',
      message: `Unexpected response from ${path}.`,
      httpStatus: response.status,
    } satisfies AuthTransportError;
  }
  return data;
}

function isBootstrapAuthenticated(
  data: unknown,
): data is BootstrapAuthenticatedBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const body = data as Record<string, unknown>;
  return (
    body.status === 'authenticated' &&
    isAuthUser(body.user) &&
    isAuthSession(body.session)
  );
}

function isBootstrapTicket(data: unknown): data is BootstrapTicketBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const body = data as Record<string, unknown>;
  return (
    body.status === 'failed' &&
    typeof body.bootstrap_ticket === 'string' &&
    typeof body.bootstrap_ticket_expires_at === 'string'
  );
}

function isCreateUserBody(data: unknown): data is CreateUserBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const body = data as Record<string, unknown>;
  return (
    (body.status === 'created' || body.status === 'authenticated') &&
    isAuthUser(body.user) &&
    isAuthSession(body.session)
  );
}

function isRefreshBody(data: unknown): data is RefreshBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const body = data as Record<string, unknown>;
  return body.status === 'rotated' && isAuthSession(body.session);
}

function isLogoutBody(data: unknown): data is LogoutBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const body = data as Record<string, unknown>;
  return body.status === 'logged_out' && typeof body.revoked === 'boolean';
}

function isMeBody(data: unknown): data is MeBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const body = data as Record<string, unknown>;
  return body.status === 'success' && isAuthUser(body.user);
}

export function createAuthClient(deps: AuthClientDeps = {}): AuthHttpClient {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const baseUrl = deps.baseUrl ?? getAppConfig().apiBaseUrl;

  return {
    async bootstrap(body) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/auth/bootstrap`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        });
      } catch (cause) {
        throw {
          kind: 'offline',
          message: 'Network unavailable.',
          cause,
        } satisfies AuthTransportError;
      }
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      // 404 ACCOUNT_NOT_FOUND is the expected "no account yet" signal: it
      // carries the single-use bootstrap ticket, not an error.
      if (response.status === 404 && isBootstrapTicket(data)) {
        return data;
      }
      if (!response.ok) {
        throw toAuthError(response.status, data);
      }
      if (!isBootstrapAuthenticated(data)) {
        throw {
          kind: 'invalid_response',
          message: 'Unexpected response from /v1/auth/bootstrap.',
          httpStatus: response.status,
        } satisfies AuthTransportError;
      }
      return data;
    },

    createUser({bootstrapTicket, displayName, phone, idempotencyKey}) {
      return postJson(
        fetchImpl,
        baseUrl,
        '/v1/users',
        {
          bootstrap_ticket: bootstrapTicket,
          display_name: displayName,
          ...(phone ? {phone} : {}),
        },
        {'Idempotency-Key': idempotencyKey},
        isCreateUserBody,
      );
    },

    refresh(refreshToken) {
      return postJson(
        fetchImpl,
        baseUrl,
        '/v1/auth/refresh',
        {refresh_token: refreshToken},
        {},
        isRefreshBody,
      );
    },

    async logout(accessToken) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/auth/logout`, {
          method: 'POST',
          headers: {
            ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}),
          },
        });
      } catch (cause) {
        throw {
          kind: 'offline',
          message: 'Network unavailable.',
          cause,
        } satisfies AuthTransportError;
      }
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      // Logout is idempotent server-side; an expired session is already the
      // desired end state, so 401 still resolves as logged out.
      if (response.status === 401) {
        return {
          request_id: createRequestId(),
          status: 'logged_out',
          revoked: false,
        };
      }
      if (!response.ok) {
        throw toAuthError(response.status, data);
      }
      if (!isLogoutBody(data)) {
        throw {
          kind: 'invalid_response',
          message: 'Unexpected response from /v1/auth/logout.',
          httpStatus: response.status,
        } satisfies AuthTransportError;
      }
      return data;
    },

    async me(accessToken) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/me`, {
          method: 'GET',
          headers: {Authorization: `Bearer ${accessToken}`},
        });
      } catch (cause) {
        throw {
          kind: 'offline',
          message: 'Network unavailable.',
          cause,
        } satisfies AuthTransportError;
      }
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok) {
        throw toAuthError(response.status, data);
      }
      if (!isMeBody(data)) {
        throw {
          kind: 'invalid_response',
          message: 'Unexpected response from /v1/me.',
          httpStatus: response.status,
        } satisfies AuthTransportError;
      }
      return data;
    },

    async updateMe({accessToken, displayName, phone}) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/me`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            ...(displayName !== undefined ? {display_name: displayName} : {}),
            ...(phone !== undefined ? {phone} : {}),
          }),
        });
      } catch (cause) {
        throw {
          kind: 'offline',
          message: 'Network unavailable.',
          cause,
        } satisfies AuthTransportError;
      }
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok) {
        throw toAuthError(response.status, data);
      }
      if (!isMeBody(data)) {
        throw {
          kind: 'invalid_response',
          message: 'Unexpected response from PATCH /v1/me.',
          httpStatus: response.status,
        } satisfies AuthTransportError;
      }
      return data;
    },
  };
}
