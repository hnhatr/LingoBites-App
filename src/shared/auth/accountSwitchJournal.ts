import * as Keychain from 'react-native-keychain';
import type {AuthUser} from './authTypes';

/**
 * Durable, attempt-bound account-switch journal (LING-92 P2 / AD-005).
 *
 * One versioned record in Keychain survives SQLite wipe and app restart.
 * Tokens never belong in this payload — candidate session tokens stay in
 * `sessionStore` under `target_session_id`.
 */

export const ACCOUNT_SWITCH_JOURNAL_SERVICE =
  'com.lingobites.auth.account-switch';
const JOURNAL_USERNAME = 'account-switch-attempt';
export const ACCOUNT_SWITCH_ATTEMPT_VERSION = 1;

export type AccountSwitchPhase = 'awaiting' | 'confirmed';

export type AccountSwitchAttemptV1 = {
  version: typeof ACCOUNT_SWITCH_ATTEMPT_VERSION;
  attempt_id: string;
  source_account_id: string;
  target_account_id: string;
  target_session_id: string;
  target_user_snapshot: AuthUser;
  phase: AccountSwitchPhase;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
};

export type AccountSwitchOwnership = {
  sourceAccountId: string;
  targetAccountId: string;
};

export type JournalParseErrorCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_PAYLOAD'
  | 'CONTAINS_TOKEN';

export type JournalResult<T> =
  | {ok: true; value: T}
  | {
      ok: false;
      errorCode: JournalParseErrorCode | 'KEYCHAIN_ERROR';
      error?: unknown;
    };

const AUTH_USER_SNAPSHOT_KEYS: ReadonlyArray<keyof AuthUser> = [
  'id',
  'public_code',
  'display_name',
  'phone_e164',
  'status',
  'created_at',
  'updated_at',
];

const TOKEN_FIELD_NAMES = new Set([
  'access_token',
  'refresh_token',
  'access_expires_at',
  'refresh_expires_at',
  'session_id',
]);

function isTokenLikeFieldName(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes('token') ||
    lower.includes('secret') ||
    lower === 'password' ||
    lower.includes('credential')
  );
}

/** Persists only the frozen AuthUser fields (no token-like extras). */
export function canonicalizeTargetUserSnapshot(user: AuthUser): AuthUser {
  return {
    id: user.id,
    public_code: user.public_code,
    display_name: user.display_name,
    phone_e164: user.phone_e164,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function containsForbiddenTokenFields(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(containsForbiddenTokenFields);
  }
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (TOKEN_FIELD_NAMES.has(key) || isTokenLikeFieldName(key)) {
      return true;
    }
    if (containsForbiddenTokenFields(nested)) {
      return true;
    }
  }
  return false;
}

function parseTargetUserSnapshot(raw: unknown): JournalResult<AuthUser> {
  if (raw === null || typeof raw !== 'object') {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!AUTH_USER_SNAPSHOT_KEYS.includes(key as keyof AuthUser)) {
      if (isTokenLikeFieldName(key)) {
        return {ok: false, errorCode: 'CONTAINS_TOKEN'};
      }
    }
  }
  if (!isAuthUserSnapshot(record)) {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }
  return {ok: true, value: canonicalizeTargetUserSnapshot(record as AuthUser)};
}

function isAuthUserSnapshot(value: unknown): value is AuthUser {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.public_code === 'string' &&
    typeof user.display_name === 'string' &&
    (user.phone_e164 === null || typeof user.phone_e164 === 'string') &&
    (user.status === 'active' || user.status === 'merging') &&
    typeof user.created_at === 'string' &&
    typeof user.updated_at === 'string'
  );
}

/** Parses and validates a persisted journal record (no Keychain I/O). */
export function parseAccountSwitchAttemptV1(
  raw: string,
): JournalResult<AccountSwitchAttemptV1> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {ok: false, errorCode: 'INVALID_JSON'};
  }

  if (containsForbiddenTokenFields(parsed)) {
    return {ok: false, errorCode: 'CONTAINS_TOKEN'};
  }

  if (parsed === null || typeof parsed !== 'object') {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }

  const record = parsed as Record<string, unknown>;
  if (record.version !== ACCOUNT_SWITCH_ATTEMPT_VERSION) {
    return {ok: false, errorCode: 'UNSUPPORTED_VERSION'};
  }

  const phase = record.phase;
  if (phase !== 'awaiting' && phase !== 'confirmed') {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }

  if (
    typeof record.attempt_id !== 'string' ||
    typeof record.source_account_id !== 'string' ||
    typeof record.target_account_id !== 'string' ||
    typeof record.target_session_id !== 'string' ||
    typeof record.created_at !== 'string' ||
    typeof record.updated_at !== 'string' ||
    !(record.confirmed_at === null || typeof record.confirmed_at === 'string')
  ) {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }

  const snapshot = parseTargetUserSnapshot(record.target_user_snapshot);
  if (!snapshot.ok) {
    return snapshot;
  }

  if (snapshot.value.id !== record.target_account_id) {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }

  return {
    ok: true,
    value: {
      version: ACCOUNT_SWITCH_ATTEMPT_VERSION,
      attempt_id: record.attempt_id,
      source_account_id: record.source_account_id,
      target_account_id: record.target_account_id,
      target_session_id: record.target_session_id,
      target_user_snapshot: snapshot.value,
      phase,
      created_at: record.created_at,
      updated_at: record.updated_at,
      confirmed_at: record.confirmed_at as string | null,
    },
  };
}

export function serializeAccountSwitchAttemptV1(
  attempt: AccountSwitchAttemptV1,
): string {
  return JSON.stringify(attempt);
}

/** Returns false when the journal attempt does not match trusted A/B ids. */
export function attemptMatchesOwnership(
  attempt: AccountSwitchAttemptV1,
  ownership: AccountSwitchOwnership,
): boolean {
  return (
    attempt.source_account_id === ownership.sourceAccountId &&
    attempt.target_account_id === ownership.targetAccountId
  );
}

export async function readAccountSwitchJournal(): Promise<
  JournalResult<AccountSwitchAttemptV1 | null>
> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: ACCOUNT_SWITCH_JOURNAL_SERVICE,
    });
    if (credentials === false) {
      return {ok: true, value: null};
    }
    const parsed = parseAccountSwitchAttemptV1(credentials.password);
    if (!parsed.ok) {
      return parsed;
    }
    return {ok: true, value: parsed.value};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

export async function writeAccountSwitchJournal(
  attempt: AccountSwitchAttemptV1,
): Promise<JournalResult<void>> {
  if (containsForbiddenTokenFields(attempt)) {
    return {ok: false, errorCode: 'CONTAINS_TOKEN'};
  }
  const persisted: AccountSwitchAttemptV1 = {
    ...attempt,
    target_user_snapshot: canonicalizeTargetUserSnapshot(
      attempt.target_user_snapshot,
    ),
  };
  try {
    await Keychain.setGenericPassword(
      JOURNAL_USERNAME,
      serializeAccountSwitchAttemptV1(persisted),
      {service: ACCOUNT_SWITCH_JOURNAL_SERVICE},
    );
    return {ok: true, value: undefined};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

export async function clearAccountSwitchJournal(): Promise<
  JournalResult<void>
> {
  try {
    await Keychain.resetGenericPassword({
      service: ACCOUNT_SWITCH_JOURNAL_SERVICE,
    });
    return {ok: true, value: undefined};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}
