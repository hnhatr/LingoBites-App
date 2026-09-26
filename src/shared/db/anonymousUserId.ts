import {createRequestId} from '../api/requestId';
import {ANONYMOUS_USER_ID_KEY} from './constants';
import {getDatabase} from './database';

export function getOrCreateAnonymousUserId(): string {
  const db = getDatabase();
  const existing = db.execute(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
    [ANONYMOUS_USER_ID_KEY],
  );

  // T8: If an authenticated account is active, use its ID instead of the legacy anonymous ID.
  const authAccount = db.execute(
    "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
  );
  const accountRow = authAccount.rows?.item(0) as {value?: string} | undefined;
  if (accountRow?.value) {
    return accountRow.value;
  }

  const row = existing.rows?.item(0) as {value?: string} | undefined;
  if (row?.value) {
    return row.value;
  }

  const userId = createRequestId();
  const now = new Date().toISOString();
  db.execute(
    'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [ANONYMOUS_USER_ID_KEY, userId, now],
  );

  return userId;
}
