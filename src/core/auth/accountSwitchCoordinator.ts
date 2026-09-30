import {createRequestId} from '../api/requestId';
import {
  ACCOUNT_SWITCH_ATTEMPT_VERSION,
  type AccountSwitchAttemptV1,
  type AccountSwitchOwnership,
  type AccountSwitchPhase,
  attemptMatchesOwnership,
  canonicalizeTargetUserSnapshot,
  clearAccountSwitchJournal,
  type JournalResult,
  readAccountSwitchJournal,
  writeAccountSwitchJournal,
} from './accountSwitchJournal';
import type {AuthUser} from './authTypes';

export type StageAccountSwitchInput = AccountSwitchOwnership & {
  targetSessionId: string;
  targetUserSnapshot: AuthUser;
  now?: () => string;
  newAttemptId?: () => string;
};

export type CoordinatorErrorCode =
  | 'NO_ACTIVE_ATTEMPT'
  | 'STALE_ATTEMPT_ID'
  | 'OWNERSHIP_MISMATCH'
  | 'CONFIRMED_ATTEMPT_LOCKED'
  | 'DUPLICATE_ATTEMPT_ID'
  | 'INVALID_PHASE'
  | 'KEYCHAIN_ERROR'
  | 'INVALID_JOURNAL'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_JSON'
  | 'INVALID_PAYLOAD'
  | 'CONTAINS_TOKEN';

export type CoordinatorResult<T> =
  | {ok: true; value: T}
  | {ok: false; errorCode: CoordinatorErrorCode; error?: unknown};

export type RecoverContext = {
  /** SQLite `current_account_id` (null when missing / fresh). */
  localAccountId: string | null;
  /** User id resolved from the active session pointer, if any. */
  activeSessionUserId: string | null;
  /** True after the account-replacement DB transaction committed to target B. */
  dbCommittedToTarget: boolean;
};

export type AccountSwitchRecovery =
  | {kind: 'none'}
  | {kind: 'awaiting_confirmation'; attempt: AccountSwitchAttemptV1}
  | {kind: 'confirmed_retry_wipe'; attempt: AccountSwitchAttemptV1}
  | {kind: 'confirmed_activate'; attempt: AccountSwitchAttemptV1}
  | {kind: 'cleared_stale_journal'}
  | {kind: 'invalid_journal'; errorCode: CoordinatorErrorCode};

let singleFlightTail: Promise<unknown> = Promise.resolve();

function runSingleFlight<T>(operation: () => Promise<T>): Promise<T> {
  const next = singleFlightTail.then(() => operation());
  singleFlightTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultAttemptId(): string {
  return createRequestId();
}

function mapJournalError<T>(result: JournalResult<T>): CoordinatorResult<T> {
  if (result.ok) {
    return result;
  }
  return {
    ok: false,
    errorCode: result.errorCode as CoordinatorErrorCode,
    error: result.error,
  };
}

function buildAttempt(
  input: StageAccountSwitchInput,
  phase: AccountSwitchPhase,
  attemptId: string,
  timestamps: {
    createdAt: string;
    updatedAt: string;
    confirmedAt: string | null;
  },
): AccountSwitchAttemptV1 {
  return {
    version: ACCOUNT_SWITCH_ATTEMPT_VERSION,
    attempt_id: attemptId,
    source_account_id: input.sourceAccountId,
    target_account_id: input.targetAccountId,
    target_session_id: input.targetSessionId,
    target_user_snapshot: canonicalizeTargetUserSnapshot(
      input.targetUserSnapshot,
    ),
    phase,
    created_at: timestamps.createdAt,
    updated_at: timestamps.updatedAt,
    confirmed_at: timestamps.confirmedAt,
  };
}

/** Clears in-memory single-flight state between tests. */
export function resetAccountSwitchCoordinatorForTests(): void {
  singleFlightTail = Promise.resolve();
}

/**
 * Persists an `awaiting` attempt. Replaces an existing awaiting record; refuses
 * when a `confirmed` attempt is already durable.
 */
export async function stageAccountSwitchAttempt(
  input: StageAccountSwitchInput,
): Promise<CoordinatorResult<AccountSwitchAttemptV1>> {
  return runSingleFlight(async () => {
    if (input.targetAccountId !== input.targetUserSnapshot.id) {
      return {ok: false, errorCode: 'OWNERSHIP_MISMATCH'};
    }

    const now = input.now ?? defaultNow;
    const newAttemptId = input.newAttemptId ?? defaultAttemptId;

    const existing = mapJournalError(await readAccountSwitchJournal());
    if (!existing.ok) {
      return existing;
    }

    if (existing.value?.phase === 'confirmed') {
      return {ok: false, errorCode: 'CONFIRMED_ATTEMPT_LOCKED'};
    }

    const attemptId = newAttemptId();
    if (existing.value?.attempt_id === attemptId) {
      return {ok: false, errorCode: 'DUPLICATE_ATTEMPT_ID'};
    }
    const iso = now();
    const attempt = buildAttempt(input, 'awaiting', attemptId, {
      createdAt: iso,
      updatedAt: iso,
      confirmedAt: null,
    });

    const written = mapJournalError(await writeAccountSwitchJournal(attempt));
    if (!written.ok) {
      return written;
    }
    return {ok: true, value: attempt};
  });
}

export async function confirmAccountSwitchAttempt(
  attemptId: string,
  ownership: AccountSwitchOwnership,
): Promise<CoordinatorResult<AccountSwitchAttemptV1>> {
  return runSingleFlight(async () => {
    const existing = mapJournalError(await readAccountSwitchJournal());
    if (!existing.ok) {
      return existing;
    }
    if (existing.value === null) {
      return {ok: false, errorCode: 'NO_ACTIVE_ATTEMPT'};
    }

    const attempt = existing.value;
    if (attempt.attempt_id !== attemptId) {
      return {ok: false, errorCode: 'STALE_ATTEMPT_ID'};
    }
    if (!attemptMatchesOwnership(attempt, ownership)) {
      return {ok: false, errorCode: 'OWNERSHIP_MISMATCH'};
    }

    if (attempt.phase === 'confirmed') {
      return {ok: true, value: attempt};
    }

    const updated: AccountSwitchAttemptV1 = {
      ...attempt,
      phase: 'confirmed',
      updated_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    };
    const written = mapJournalError(await writeAccountSwitchJournal(updated));
    if (!written.ok) {
      return written;
    }
    return {ok: true, value: updated};
  });
}

export async function cancelAccountSwitchAttempt(
  attemptId: string,
): Promise<CoordinatorResult<void>> {
  return runSingleFlight(async () => {
    const existing = mapJournalError(await readAccountSwitchJournal());
    if (!existing.ok) {
      return existing;
    }
    if (existing.value === null) {
      return {ok: false, errorCode: 'NO_ACTIVE_ATTEMPT'};
    }

    const attempt = existing.value;
    if (attempt.attempt_id !== attemptId) {
      return {ok: false, errorCode: 'STALE_ATTEMPT_ID'};
    }
    if (attempt.phase === 'confirmed') {
      return {ok: false, errorCode: 'CONFIRMED_ATTEMPT_LOCKED'};
    }

    const cleared = mapJournalError(await clearAccountSwitchJournal());
    if (!cleared.ok) {
      return cleared;
    }
    return {ok: true, value: undefined};
  });
}

/**
 * Classifies durable journal state for boot recovery (AD-005 truth table).
 * May clear an orphaned journal when B is already active with matching DB state.
 */
export async function recoverAccountSwitchAttempt(
  context: RecoverContext,
): Promise<CoordinatorResult<AccountSwitchRecovery>> {
  return runSingleFlight(async () => {
    const existing = mapJournalError(await readAccountSwitchJournal());
    if (!existing.ok) {
      if (
        existing.errorCode === 'INVALID_JSON' ||
        existing.errorCode === 'UNSUPPORTED_VERSION' ||
        existing.errorCode === 'INVALID_PAYLOAD' ||
        existing.errorCode === 'CONTAINS_TOKEN'
      ) {
        return {
          ok: true,
          value: {kind: 'invalid_journal', errorCode: existing.errorCode},
        };
      }
      return existing;
    }

    if (existing.value === null) {
      return {ok: true, value: {kind: 'none'}};
    }

    const attempt = existing.value;

    const active = context.activeSessionUserId;
    if (active !== null) {
      const allowedActive = context.dbCommittedToTarget
        ? [attempt.source_account_id, attempt.target_account_id]
        : [attempt.source_account_id];
      if (!allowedActive.includes(active)) {
        return {
          ok: true,
          value: {kind: 'invalid_journal', errorCode: 'INVALID_JOURNAL'},
        };
      }
    }

    const localIsSource =
      context.localAccountId !== null &&
      context.localAccountId === attempt.source_account_id;
    const localIsTarget =
      context.localAccountId !== null &&
      context.localAccountId === attempt.target_account_id;
    const activeIsTarget =
      context.activeSessionUserId !== null &&
      context.activeSessionUserId === attempt.target_account_id;

    if (
      attempt.phase === 'confirmed' &&
      context.dbCommittedToTarget &&
      localIsTarget &&
      activeIsTarget
    ) {
      const cleared = mapJournalError(await clearAccountSwitchJournal());
      if (!cleared.ok) {
        return cleared;
      }
      return {ok: true, value: {kind: 'cleared_stale_journal'}};
    }

    if (attempt.phase === 'awaiting' && localIsSource) {
      return {ok: true, value: {kind: 'awaiting_confirmation', attempt}};
    }

    if (
      attempt.phase === 'confirmed' &&
      localIsSource &&
      !context.dbCommittedToTarget
    ) {
      return {ok: true, value: {kind: 'confirmed_retry_wipe', attempt}};
    }

    if (
      attempt.phase === 'confirmed' &&
      context.dbCommittedToTarget &&
      localIsTarget
    ) {
      return {ok: true, value: {kind: 'confirmed_activate', attempt}};
    }

    return {
      ok: true,
      value: {kind: 'invalid_journal', errorCode: 'INVALID_JOURNAL'},
    };
  });
}

/** Reads the current durable attempt without mutating state. */
export async function readCurrentAccountSwitchAttempt(): Promise<
  CoordinatorResult<AccountSwitchAttemptV1 | null>
> {
  return runSingleFlight(async () =>
    mapJournalError(await readAccountSwitchJournal()),
  );
}
