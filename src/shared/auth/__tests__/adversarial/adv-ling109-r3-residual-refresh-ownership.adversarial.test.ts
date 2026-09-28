import {validFullOutput} from '@shared/fixtures';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {saveYouTubeProgress} from '@features/youtube/logic/data/YouTubeProgressRepository';
import {recordFlashcardRating, saveFlashcard} from '@features/review';
import {saveContentLesson} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {drainOutboxOnce} from '@features/sync/logic/outboxSync';
import * as DeviceIdentityNative from '@shared/identity/deviceIdentityNative';
import {resetAccountStoreForTests} from '@features/account/logic/useAccountStore';
import {
  resetBootStateForTests,
  confirmAccountSwitch,
} from '../../../../features/account/logic/accountBootstrap';
import {resetRefreshStateForTests} from '../../authSession';
import {
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '../../accountSwitchCoordinator';
import {
  AUTH_SESSION_SERVICE_PREFIX,
  getActiveSession,
  saveSession,
  setActiveSessionId,
} from '../../sessionStore';
import {installKeychainVault} from '@/test-support/keychainVault';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';
import type {AuthUser} from '../../authTypes';

jest.mock('../../../../features/profile/logic/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));

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
  session_id: expiredA.session_id,
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

describe('ADV-004 / INV-003: residual refresh ownership window after the check', () => {
  it('ADV-004 / INV-003: a switch committing between the ownership check and the pointer write must not leave A active', async () => {
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

    // Hold the rotated-A session record write (saveSession) that happens *after*
    // isAccountStillOwner() has already returned true, until the A->B switch
    // has committed and activated B.
    const Keychain = jest.requireMock('react-native-keychain') as any;
    const realSet = Keychain.setGenericPassword.getMockImplementation();
    const aService = `${AUTH_SESSION_SERVICE_PREFIX}${expiredA.session_id}`;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let reached!: () => void;
    const reachedP = new Promise<void>(resolve => {
      reached = resolve;
    });
    let paused = false;
    Keychain.setGenericPassword.mockImplementation(
      async (
        username: string,
        password: string,
        options?: {service?: string},
      ) => {
        if (!paused && options?.service === aService) {
          paused = true;
          reached();
          await gate;
        }
        return realSet(username, password, options);
      },
    );

    const sent: string[] = [];
    mockFetch.mockImplementation(async (url: string, init?: any) => {
      if (url.endsWith('/v1/auth/refresh')) {
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

    expect(sent).not.toContain(`Bearer ${sessionB.access_token}`);
    const active = await getActiveSession();
    expect(active.ok).toBe(true);
    if (!active.ok) throw new Error('expected active session');
    expect(active.value?.user_id).toBe(userB.id);
  });
});
