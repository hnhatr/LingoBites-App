import {getDatabase} from '@core/db/database';

export const DILIGENT_BADGE_LATCH_KEY = 'engagement.badge_diligent_earned_at';

/**
 * Durable queue when the latch INSERT fails (ADV-001/ADV-002). Same wipe paths as
 * the latch; not synced. Promoted to {@link DILIGENT_BADGE_LATCH_KEY} on retry.
 */
export const DILIGENT_BADGE_PENDING_KEY =
  'engagement.badge_diligent_pending_at';

function readSetting(key: string): string | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
    [key],
  );
  const row = result.rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

/** ISO timestamp when the diligent badge was first observed earned, or null. */
export function readDiligentBadgeLatch(): string | null {
  return readSetting(DILIGENT_BADGE_LATCH_KEY);
}

/** ISO earn time queued durably after a failed latch write, or null. */
export function readPendingDiligentObservation(): string | null {
  return readSetting(DILIGENT_BADGE_PENDING_KEY);
}

/** Persists the first observed earn time; later writes are ignored (INV-002). */
export function latchDiligentBadgeEarnedAt(earnedAtIso: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.execute(
    'INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [DILIGENT_BADGE_LATCH_KEY, earnedAtIso, now],
  );
}

/** Records a failed latch attempt so a later read can promote it (INV-002). */
export function writePendingDiligentObservation(earnedAtIso: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.execute(
    'INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [DILIGENT_BADGE_PENDING_KEY, earnedAtIso, now],
  );
}

export function clearPendingDiligentObservation(): void {
  const db = getDatabase();
  db.execute('DELETE FROM app_settings WHERE key = ?;', [
    DILIGENT_BADGE_PENDING_KEY,
  ]);
}
