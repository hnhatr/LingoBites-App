import type {DeviceIdentifier} from '../identity';

/**
 * Mobile mirror of the frozen T1 auth contracts (api-server
 * `src/schemas/auth.ts` + `src/auth/*`, SETE-295). These types are a
 * hand-written client copy of that contract — they must stay shape-compatible
 * with the server schemas and must not be redefined per call site.
 */

export type AuthUserStatus = 'active' | 'merging';

export type AuthUser = {
  id: string;
  public_code: string;
  display_name: string;
  phone_e164: string | null;
  status: AuthUserStatus;
  created_at: string;
  updated_at: string;
};

export type AuthSession = {
  session_id: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

export type BootstrapIdentifierBody = {
  identifier_kind: DeviceIdentifier['kind'];
  identifier_value: string;
};

export type BootstrapAuthenticatedBody = {
  request_id: string;
  status: 'authenticated';
  user: AuthUser;
  session: AuthSession;
};

export type BootstrapTicketBody = {
  request_id: string;
  status: 'failed';
  error: {code: string; message: string};
  bootstrap_ticket: string;
  bootstrap_ticket_expires_at: string;
};

export type CreateUserBody = {
  request_id: string;
  status: 'created' | 'authenticated';
  user: AuthUser;
  session: AuthSession;
};

export type RefreshBody = {
  request_id: string;
  status: 'rotated';
  session: AuthSession;
};

export type LogoutBody = {
  request_id: string;
  status: 'logged_out';
  revoked: boolean;
};

export type MeBody = {
  request_id: string;
  status: 'success';
  user: AuthUser;
};

export type ApiErrorBody = {
  request_id: string;
  status: 'failed';
  error: {code: string; message: string};
  retryable?: boolean;
};

/** Server error codes the mobile client branches on (subset of T1). */
export const AUTH_ERROR_CODES = [
  'ACCOUNT_NOT_FOUND',
  'INVALID_DEVICE_IDENTIFIER',
  'INVALID_DISPLAY_NAME',
  'INVALID_PHONE',
  'INVALID_SESSION',
  'TOKEN_EXPIRED',
  'SESSION_REPLAYED',
  'MERGE_IN_PROGRESS',
  'MISSING_IDEMPOTENCY_KEY',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'DATABASE_UNAVAILABLE',
  'VALIDATION_USER',
  'VALIDATION_AUTH',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number] | string;
