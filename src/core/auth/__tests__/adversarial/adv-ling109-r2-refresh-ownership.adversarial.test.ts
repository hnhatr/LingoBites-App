import {
  confirmAccountSwitch,
  resetBootStateForTests,
} from '@features/account/logic/accountBootstrap';
import {resetAccountStoreForTests} from '@features/account/logic/useAccountStore';
import {saveContentLesson} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {recordFlashcardRating, saveFlashcard} from '@features/review';
import {saveGrammarBookmark} from '@features/review/logic/GrammarBookmarkRepository';
import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '@features/sync/logic/outboxSync';
import {saveYouTubeProgress} from '@features/youtube/logic/data/YouTubeProgressRepository';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {validFullOutput} from '@core/fixtures';
import * as DeviceIdentityNative from '@core/identity/deviceIdentityNative';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {installKeychainVault} from '@test/support/keychainVault';

import {
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '../../accountSwitchCoordinator';
import {resetRefreshStateForTests} from '../../authSession';
import type {AuthUser} from '../../authTypes';
import {
  AUTH_ACTIVE_SESSION_SERVICE,
  clearAllSessions,
  getActiveSession,
  saveSession,
  setActiveSessionId,
} from '../../sessionStore';

jest.mock('@features/account/logic/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

/**
 * LING-109 adversarial re-review r2 (TASK-021): the ADV-001 ownership guard is
 * evaluated after `ensureValidSession`, but that helper can itself move the
 * active-session pointer across an await. This attacks that window.
 */

function makeUser(id: string, name: string): AuthUser {
  return {
    id,
    public_code: `LB-${name}`,
    display_name: name,
    phone_e164: null,
    status: 'active',
    created_at: '2026-09-27T00:00:00.000Z',
    updated_at: '2026-09-27T00:00:00.000Z',
  };
}

const userA = makeUser('11111111-1111-4111-8111-111111111111', 'AAAA');
const userB = makeUser('22222222-2222-4222-8222-222222222222', 'BBBB');

const expiredA = {
  session_id: '33333333-3333-4333-8333-333333333333',
  access_token: 'lb_at_a_old',
  refresh_token: 'lb_rt_a',
  access_expires_at: new Date(Date.now() - 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};
const rotatedA = {
  session_id: '33333333-3333-4333-8333-333333333333',
  access_token: 'lb_at_a_new',
  refresh_token: 'lb_rt_a_new',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};
const sessionB = {
  session_id: '44444444-4444-4444-8444-444444444444',
  access_token: 'lb_at_b',
  refresh_token: 'lb_rt_b',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(body),
});

const baseFetch = jest.fn(async (url: string, _init?: any) => {
  if (url.endsWith('/v1/auth/bootstrap')) {
    return json(200, {
      request_id: 'b',
      status: 'authenticated',
      user: userA,
      session: sessionB,
    });
  }
  if (url.endsWith('/v1/auth/logout')) return json(200, {status: 'success'});
  if (url.endsWith('/v1/auth/me')) {
    return json(200, {request_id: 'm', status: 'success', user: userA});
  }
  return json(404, {});
});
const mockFetch = jest.fn(baseFetch);
global.fetch = mockFetch as unknown as typeof fetch;

let db: RealSqliteConnection;

function seedInstall(accountId: string) {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', accountId, '2026-09-27T00:00:00.000Z'],
  );
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [
      'account.install_completed_v1',
      '2026-09-27T00:00:00.000Z',
      '2026-09-27T00:00:00.000Z',
    ],
  );
}

function writeLearnerData() {
  saveYouTubeProgress({lessonId: 'yt-a', positionMs: 5000, segmentIndex: 2});
  const saved = saveFlashcard({
    lessonId: 'lesson-a',
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-09-27T01:00:00.000Z',
  });
  if (!saved.ok) throw new Error('saveFlashcard failed');
  recordFlashcardRating({
    flashcardId: saved.flashcardId,
    rating: 'remembered',
    reviewedAt: '2026-09-27T02:00:00.000Z',
  });
  saveContentLesson({lessonId: 'content-a', now: '2026-09-27T03:00:00.000Z'});
}

function readCurrentAccountId(): string | null {
  const row = getDatabase()
    .execute(
      "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;",
    )
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

beforeEach(() => {
  db = openRealSqlite(':memory:');
  resetDatabaseForTests(db);
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountSwitchCoordinatorForTests();
  resetAccountStoreForTests();
  mockFetch.mockReset();
  mockFetch.mockImplementation(baseFetch);
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({
      androidId: 'a1b2c3d4e5f60718',
      identifierForVendor: null,
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  resetDatabaseForTests(null);
});

describe('ADV-002 / INV-003: drain refresh clobbers the B pointer after a confirmed A→B switch', () => {
  it('ADV-002 / INV-003: the active session must still be the target account after a confirmed switch', async () => {
    await saveSession({
      ...expiredA,
      user_id: userA.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });
    await setActiveSessionId(expiredA.session_id);
    seedInstall(userA.id);
    writeLearnerData();
    await saveSession({
      ...sessionB,
      user_id: userB.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });

    const staged = await stageAccountSwitchAttempt({
      sourceAccountId: userA.id,
      targetAccountId: userB.id,
      targetSessionId: sessionB.session_id,
      targetUserSnapshot: userB,
    });
    if (!staged.ok) throw new Error('stage failed');

    // Hold the drain's access-token refresh until the switch has committed and
    // activated B; the refresh then writes the rotated A session back.
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    const sent: string[] = [];
    mockFetch.mockImplementation(async (url: string, init?: any) => {
      if (!paused && url.endsWith('/v1/auth/refresh')) {
        paused = true;
        reached();
        await gate;
        return json(200, {status: 'rotated', session: rotatedA});
      }
      if (url.endsWith('/v1/review-events')) {
        sent.push(String(init?.headers?.Authorization ?? ''));
      }
      return baseFetch(url, init);
    });

    const drainPromise = drainOutboxOnce();
    await reachedP;

    const confirmed = await confirmAccountSwitch(staged.value.attempt_id);
    expect(confirmed.status).toBe('authenticated');
    expect(readCurrentAccountId()).toBe(userB.id);

    release();
    await drainPromise;

    // No A batch may be sent with B credentials (the ADV-001 guard holds) ...
    expect(sent).not.toContain(`Bearer ${sessionB.access_token}`);
    // ... but the active session must belong to the account the switch activated.
    const active = await getActiveSession();
    expect(active.ok).toBe(true);
    if (!active.ok) throw new Error('expected active session');
    expect(active.value?.user_id).toBe(userB.id);
  });
});

describe('ADV-003 (MINOR) / INV-002: ownership abort must not penalize non-review outbox rows', () => {
  it('ADV-003: an ownership abort leaves practice/generic attempt counts untouched', async () => {
    await saveSession({
      ...rotatedA,
      user_id: userA.id,
      stored_at: '2026-09-27T00:00:00.000Z',
    });
    await setActiveSessionId(rotatedA.session_id);
    getDatabase().execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', userA.id, '2026-09-27T00:00:00.000Z'],
    );
    // a generic (non-review, non-practice) outbox row survives a session logout
    // (LING-172: `content_lesson_state` retired from sync v2; `grammar_bookmarks`
    // exercises the same generic push path)
    saveGrammarBookmark({
      lessonId: 'content-a',
      grammarId: 'grammar-a',
      packageId: 'package-a',
      now: '2026-09-27T03:00:00.000Z',
    });
    expect(listPendingSyncEvents()).toHaveLength(1);
    expect(listPendingSyncEvents()[0].attemptCount).toBe(0);

    const Keychain = jest.requireMock('react-native-keychain') as any;
    const realGet = Keychain.getGenericPassword.getMockImplementation();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    Keychain.getGenericPassword.mockImplementation(
      async (options: {service?: string}) => {
        if (!paused && options?.service === AUTH_ACTIVE_SESSION_SERVICE) {
          paused = true;
          reached();
          await gate;
        }
        return realGet(options);
      },
    );

    const drainPromise = drainOutboxOnce();
    await reachedP;
    // ownership changes without deleting the outbox (logout)
    await clearAllSessions();
    release();
    await drainPromise;

    const after = listPendingSyncEvents();
    expect(after).toHaveLength(1);
    expect(after[0].attemptCount).toBe(0);
  });
});
