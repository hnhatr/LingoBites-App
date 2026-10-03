import {getDatabase} from '@core/db/database';

export const DILIGENT_BADGE_LATCH_KEY = 'engagement.badge_diligent_earned_at';

/** ISO timestamp when the diligent badge was first observed earned, or null. */
export function readDiligentBadgeLatch(): string | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
    [DILIGENT_BADGE_LATCH_KEY],
  );
  const row = result.rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
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
