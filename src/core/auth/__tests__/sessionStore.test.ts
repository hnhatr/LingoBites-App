import {
  AUTH_ACTIVE_SESSION_SERVICE,
  AUTH_SESSION_SERVICE_PREFIX,
  clearAllSessions,
  deleteSession,
  getActiveSession,
  getActiveSessionId,
  getSession,
  listSessionIds,
  saveSession,
  setActiveSessionId,
} from '../sessionStore';
import type {StoredSession} from '../sessionStore';
import {installKeychainVault, vault} from '../../../test-support/keychainVault';

function record(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    session_id: '22222222-2222-4222-8222-222222222222',
    access_token: 'lb_at_access',
    refresh_token: 'lb_rt_refresh',
    access_expires_at: '2026-09-14T01:00:00.000Z',
    refresh_expires_at: '2026-09-21T00:00:00.000Z',
    user_id: '11111111-1111-4111-8111-111111111111',
    stored_at: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  installKeychainVault();
});

describe('sessionStore (SETE-303 / T6)', () => {
  it('keys sessions by session id, never by account id (account-neutral)', async () => {
    await expect(saveSession(record())).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(
      vault.has(`${AUTH_SESSION_SERVICE_PREFIX}${record().session_id}`),
    ).toBe(true);
    expect([...vault.keys()].some(key => key.includes(record().user_id))).toBe(
      false,
    );
  });

  it('round-trips the active session through the pointer', async () => {
    await saveSession(record());
    await setActiveSessionId(record().session_id);
    await expect(getActiveSessionId()).resolves.toEqual({
      ok: true,
      value: record().session_id,
    });
    const active = await getActiveSession();
    expect(active).toEqual({ok: true, value: record()});
  });

  it('returns null for a missing or corrupt session instead of throwing', async () => {
    await expect(getSession('nope')).resolves.toEqual({ok: true, value: null});
    vault.set(`${AUTH_SESSION_SERVICE_PREFIX}bad`, {
      username: 'auth-session',
      password: '{not json',
    });
    await expect(getSession('bad')).resolves.toEqual({ok: true, value: null});
  });

  it('enumerates stored sessions and clears all of them (terminal reset)', async () => {
    await saveSession(record());
    await saveSession(
      record({session_id: 'session-b', access_token: 'lb_at_b'}),
    );
    await setActiveSessionId(record().session_id);

    await expect(listSessionIds()).resolves.toEqual({
      ok: true,
      value: expect.arrayContaining([record().session_id, 'session-b']),
    });

    const cleared = await clearAllSessions();
    expect(cleared).toEqual({
      ok: true,
      value: {
        clearedSessionIds: expect.arrayContaining([
          record().session_id,
          'session-b',
        ]),
      },
    });
    expect(vault.size).toBe(0);
    await expect(getActiveSession()).resolves.toEqual({ok: true, value: null});
  });

  it('leaves non-auth Keychain entries (lesson tokens) untouched', async () => {
    vault.set('com.lingobites.lesson-v2.lesson-1', {
      username: 'capability-token',
      password: 'lesson-token',
    });
    await saveSession(record());
    await setActiveSessionId(record().session_id);
    await clearAllSessions();
    expect(vault.get('com.lingobites.lesson-v2.lesson-1')?.password).toBe(
      'lesson-token',
    );
  });

  it('deletes a single session without touching the active pointer', async () => {
    await saveSession(record());
    await setActiveSessionId(record().session_id);
    await expect(deleteSession(record().session_id)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(vault.has(AUTH_ACTIVE_SESSION_SERVICE)).toBe(true);
  });
});
