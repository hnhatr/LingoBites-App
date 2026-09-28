import {getDatabase} from '@shared/db/database';
import {getActiveSession} from '@shared/auth/sessionStore';

export const SYNC_OWNERSHIP_CHANGED = 'SYNC_OWNERSHIP_CHANGED';

function readLocalAccountId(): string | null {
  const db = getDatabase();
  const result = db.execute(
    "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
  );
  const row = result.rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

let drainOwnerAccountId: string | null | undefined;

/** Pins the local account id for an in-flight outbox drain (see `drainOutboxOnce`). */
export function beginSyncDrainOwnership(): string | null {
  const owner = readLocalAccountId();
  drainOwnerAccountId = owner;
  return owner;
}

export function endSyncDrainOwnership(): void {
  drainOwnerAccountId = undefined;
}

/** Aborts network work when the active session or local pointer moved mid-drain. */
export async function assertSyncDrainOwnershipUnchanged(): Promise<boolean> {
  if (drainOwnerAccountId === undefined) {
    return true;
  }
  const local = readLocalAccountId();
  if (local !== drainOwnerAccountId) {
    return false;
  }
  const active = await getActiveSession();
  if (!active.ok) {
    return false;
  }
  if (active.value === null) {
    return drainOwnerAccountId === null;
  }
  return active.value.user_id === drainOwnerAccountId;
}

export class SyncOwnershipChangedError extends Error {
  readonly code = SYNC_OWNERSHIP_CHANGED;

  constructor() {
    super(SYNC_OWNERSHIP_CHANGED);
    this.name = 'SyncOwnershipChangedError';
  }
}
