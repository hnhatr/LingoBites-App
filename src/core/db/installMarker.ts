import {ANONYMOUS_USER_ID_KEY} from './constants';
import {getDatabase} from './database';

/**
 * Fresh-install marker (SETE-303 / T6).
 *
 * The marker row is written to SQLite `app_settings` once the first
 * account bootstrap completes on an install. Keychain entries survive app
 * uninstall on iOS while SQLite does not, so a missing marker means this
 * install has no local state: the bootstrap orchestrator must clear any
 * persisted Keychain sessions *before* creating a fallback account, or a
 * stale pre-uninstall session would be silently restored as the wrong
 * account ("accidental fallback-account restoration").
 */
export const INSTALL_MARKER_KEY = 'account.install_completed_v1';

function readSetting(key: string): string | null {
  const db = getDatabase();
  const result = db.execute(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
    [key],
  );
  const row = result.rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, value, now],
  );
}

/**
 * True when this install already completed an account bootstrap. Any SQLite
 * failure reads as absent (cleanup + re-bootstrap is the safe direction: the
 * server resolves the same device identifier to the existing account, so no
 * duplicate is created).
 */
export function hasInstallMarker(): boolean {
  try {
    return readSetting(INSTALL_MARKER_KEY) !== null;
  } catch {
    return false;
  }
}

/** Records that this install completed its first account bootstrap. */
export function setInstallMarker(
  completedAt: string = new Date().toISOString(),
): boolean {
  try {
    writeSetting(INSTALL_MARKER_KEY, completedAt);
    return true;
  } catch {
    return false;
  }
}

export {ANONYMOUS_USER_ID_KEY};
