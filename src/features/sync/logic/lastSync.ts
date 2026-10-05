import {getDatabase} from '@core/db/database';

/**
 * When this device last finished a successful exchange with the sync server
 * (F6 "Đồng bộ lần cuối"). Written after an outbox drain that leaves nothing
 * pending and after a pull that reaches the end of the feed. Device-local,
 * never synced; reads and writes never throw.
 */
export const LAST_SYNCED_AT_KEY = 'sync.last_synced_at';

export function readLastSyncedAt(): string | null {
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        LAST_SYNCED_AT_KEY,
      ])
      .rows?.item(0) as {value?: string} | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function markSyncedNow(now = new Date().toISOString()): void {
  try {
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [LAST_SYNCED_AT_KEY, now, now],
    );
  } catch {
    // Display-only metadata; a failed write must not affect sync.
  }
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/** "Chưa đồng bộ" / "Hôm nay, 08:05" / "03/10, 21:40" in local time. */
export function formatLastSyncedLabel(
  iso: string | null,
  now = new Date(),
): string {
  const ms = iso === null ? Number.NaN : Date.parse(iso);
  if (Number.isNaN(ms)) {
    return 'Chưa đồng bộ';
  }
  const at = new Date(ms);
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  if (sameDay) {
    return `Hôm nay, ${time}`;
  }
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}, ${time}`;
}
