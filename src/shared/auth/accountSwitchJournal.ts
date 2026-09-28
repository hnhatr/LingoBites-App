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

const TOKEN_FIELD_NAMES = new Set([
  'access_token',
  'refresh_token',
  'access_expires_at',
  'refresh_expires_at',
  'session_id',
]);

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
    if (TOKEN_FIELD_NAMES.has(key)) {
      return true;
    }
    if (containsForbiddenTokenFields(nested)) {
      return true;
    }
  }
  return false;
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
    !(
      record.confirmed_at === null || typeof record.confirmed_at === 'string'
    ) ||
    !isAuthUserSnapshot(record.target_user_snapshot)
  ) {
    return {ok: false, errorCode: 'INVALID_PAYLOAD'};
  }

  if (record.target_user_snapshot.id !== record.target_account_id) {
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
      target_user_snapshot: record.target_user_snapshot,
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
  try {
    await Keychain.setGenericPassword(
      JOURNAL_USERNAME,
      serializeAccountSwitchAttemptV1(attempt),
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
