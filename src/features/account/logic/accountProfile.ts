import {
  createAuthClient,
  ensureValidSession,
  isAuthApiError,
  type AuthClientError,
  type AuthHttpClient,
  type AuthUser,
} from '@shared/auth';

export type UpdateProfileResult =
  | {ok: true; user: AuthUser}
  | {ok: false; errorCode: 'OFFLINE' | 'SESSION_LOST' | 'KEYCHAIN_ERROR'}
  | {
      ok: false;
      errorCode: 'VALIDATION' | 'MERGE_IN_PROGRESS' | 'SERVER';
      message: string;
      retryable: boolean;
    };

/**
 * Updates the display name and/or optional phone via PATCH /v1/me
 * (SETE-303 / T6). The access token is resolved through the serialized
 * session lifecycle, so an expired token rotates first and a dead session
 * reports SESSION_LOST (the caller re-boots through the account gate).
 */
export async function updateAccountProfile(
  input: {displayName?: string; phone?: string | null},
  deps: {client?: AuthHttpClient} = {},
): Promise<UpdateProfileResult> {
  const client = deps.client ?? createAuthClient();
  const ensured = await ensureValidSession({client});
  if (ensured.status !== 'valid') {
    if (ensured.status === 'offline') {
      return {ok: false, errorCode: 'OFFLINE'};
    }
    if (ensured.status === 'keychain-error') {
      return {ok: false, errorCode: 'KEYCHAIN_ERROR'};
    }
    return {ok: false, errorCode: 'SESSION_LOST'};
  }
  try {
    const me = await client.updateMe({
      accessToken: ensured.session.access_token,
      ...(input.displayName !== undefined
        ? {displayName: input.displayName}
        : {}),
      ...(input.phone !== undefined ? {phone: input.phone} : {}),
    });
    return {ok: true, user: me.user};
  } catch (error) {
    const clientError = error as AuthClientError;
    if (!isAuthApiError(clientError)) {
      return {ok: false, errorCode: 'OFFLINE'};
    }
    if (
      clientError.code === 'INVALID_DISPLAY_NAME' ||
      clientError.code === 'INVALID_PHONE' ||
      clientError.code === 'VALIDATION_USER'
    ) {
      return {
        ok: false,
        errorCode: 'VALIDATION',
        message: clientError.message,
        retryable: false,
      };
    }
    if (clientError.code === 'MERGE_IN_PROGRESS') {
      return {
        ok: false,
        errorCode: 'MERGE_IN_PROGRESS',
        message: clientError.message,
        retryable: true,
      };
    }
    return {
      ok: false,
      errorCode: 'SERVER',
      message: clientError.message,
      retryable: clientError.retryable,
    };
  }
}
