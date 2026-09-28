import {
  executeLegacyClear,
  executeCanonicalLegacyClear,
} from '../../db/legacyClear';
jest.mock('../../db/legacyClear', () => ({
  executeLegacyClear: jest.fn().mockResolvedValue(undefined),
  executeCanonicalLegacyClear: jest.fn().mockResolvedValue(undefined),
}));
import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../db/constants';
import {getDatabase, resetDatabaseForTests} from '../../db/database';
import {hasInstallMarker} from '../../db/installMarker';
import * as DeviceIdentityNative from '../../identity/deviceIdentityNative';
import {
  bootAccount,
  resetBootStateForTests,
  SIGNUP_IDEMPOTENCY_KEY,
  submitOnboardingName,
} from '../accountBootstrap';
import * as authSession from '../authSession';
import {resetRefreshStateForTests} from '../authSession';
import {getActiveSession} from '../sessionStore';
import type {AuthSession, AuthUser} from '../authTypes';
import {installKeychainVault, vault} from '../../../test-support/keychainVault';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ANDROID_ID = 'a1b2c3d4e5f60718';
const FALLBACK_UUID = '123e4567-e89b-42d3-a456-426614174000';

const user: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AB12CD34',
  display_name: 'An',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

const freshSession: AuthSession = {
  session_id: '22222222-2222-4222-8222-222222222222',
  access_token: 'lb_at_access',
  refresh_token: 'lb_rt_refresh',
  access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function ticketResponse() {
  return jsonResponse(404, {
    request_id: 't1',
    status: 'failed',
    error: {code: 'ACCOUNT_NOT_FOUND', message: 'No account.'},
    bootstrap_ticket: 'bt_ticket_1',
    bootstrap_ticket_expires_at: new Date(Date.now() + 900_000).toISOString(),
  });
}

function authenticatedResponse() {
  return jsonResponse(200, {
    request_id: 'b1',
    status: 'authenticated',
    user,
    session: freshSession,
  });
}

function createdResponse() {
  return jsonResponse(201, {
    request_id: 'c1',
    status: 'created',
    user,
    session: freshSession,
  });
}

function bootstrapBodies(): Array<Record<string, string>> {
  return mockFetch.mock.calls
    .filter(([url]) => (url as string).endsWith('/v1/auth/bootstrap'))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  mockFetch.mockReset();
  jest
    .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
    .mockResolvedValue({
      androidId: null,
      identifierForVendor: null,
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('accountBootstrap fresh install (SETE-303 / T6)', () => {
  it('clears persisted Keychain sessions before creating a fallback account', async () => {
    const order: string[] = [];
    const Keychain = jest.requireMock('react-native-keychain') as {
      resetGenericPassword: jest.Mock;
    };
    Keychain.resetGenericPassword.mockImplementation(
      async (options: {service?: string}) => {
        order.push(`reset:${options?.service ?? 'default'}`);
        vault.delete(options?.service ?? 'default');
        return true;
      },
    );
    mockFetch.mockImplementation(async (url: string) => {
      order.push(`fetch:${url}`);
      return ticketResponse();
    });
    // A stale pre-uninstall session lingering in Keychain.
    vault.set('com.lingobites.auth.session.stale', {
      username: 'auth-session',
      password: '{"session_id":"stale"}',
    });
    vault.set('com.lingobites.auth.active', {
      username: 'active-session',
      password: 'stale',
    });

    const result = await bootAccount({
      platform: 'ios',
      randomUuid: () => FALLBACK_UUID,
    });

    expect(result.status).toBe('needs-onboarding');
    const firstFetch = order.findIndex(entry => entry.startsWith('fetch:'));
    const resets = order.filter(entry => entry.startsWith('reset:'));
    expect(resets.length).toBeGreaterThan(0);
    expect(Math.max(...resets.map(entry => order.indexOf(entry)))).toBeLessThan(
      firstFetch,
    );
    expect(vault.has('com.lingobites.auth.session.stale')).toBe(false);
    expect(hasInstallMarker()).toBe(true);
  });

  it('reuses the persisted fallback UUID across boots of the same install', async () => {
    mockFetch.mockResolvedValue(ticketResponse());
    await bootAccount({platform: 'ios', randomUuid: () => FALLBACK_UUID});
    resetBootStateForTests();
    // A different generator on the next boot must not mint a new identity.
    await bootAccount({
      platform: 'ios',
      randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
    const bodies = bootstrapBodies();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual({
      identifier_kind: 'random_fallback',
      identifier_value: FALLBACK_UUID,
    });
    expect(bodies[1]).toEqual(bodies[0]);
  });

  it('bootstraps a known Android id straight to authenticated', async () => {
    jest
      .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
      .mockResolvedValue({androidId: ANDROID_ID, identifierForVendor: null});
    mockFetch.mockResolvedValueOnce(authenticatedResponse());
    const result = await bootAccount({platform: 'android'});
    expect(result).toEqual({status: 'authenticated', user});
    expect(bootstrapBodies()[0]).toEqual({
      identifier_kind: 'android_id',
      identifier_value: ANDROID_ID,
    });
    await expect(getActiveSession()).resolves.toMatchObject({
      ok: true,
      value: {session_id: freshSession.session_id},
    });
    expect(hasInstallMarker()).toBe(true);
  });

  it('shares one in-flight boot across concurrent callers (no duplicates)', async () => {
    mockFetch.mockResolvedValueOnce(authenticatedResponse());
    jest
      .spyOn(DeviceIdentityNative, 'readPlatformIdentifiers')
      .mockResolvedValue({androidId: ANDROID_ID, identifierForVendor: null});
    const [a, b] = await Promise.all([
      bootAccount({platform: 'android'}),
      bootAccount({platform: 'android'}),
    ]);
    expect(a).toEqual({status: 'authenticated', user});
    expect(b).toEqual({status: 'authenticated', user});
    expect(bootstrapBodies()).toHaveLength(1);
  });

  it('reports offline without setting the install marker', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    const result = await bootAccount({
      platform: 'ios',
      randomUuid: () => FALLBACK_UUID,
    });
    expect(result).toEqual({status: 'offline'});
    expect(hasInstallMarker()).toBe(false);
  });
});

describe('accountBootstrap session restore (SETE-303 / T6)', () => {
  it('restores a live session via /me without bootstrapping', async () => {
    // Seed a completed install: marker + active session.
    mockFetch.mockResolvedValueOnce(ticketResponse());
    await bootAccount({platform: 'ios', randomUuid: () => FALLBACK_UUID});
    resetBootStateForTests();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        request_id: 'c2',
        status: 'created',
        user,
        session: freshSession,
      }),
    );
    const submitted = await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_1',
      displayName: 'An',
    });
    expect(submitted.status).toBe('authenticated');

    // Next boot: /me validates the stored session; bootstrap never fires.
    resetBootStateForTests();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'm1', status: 'success', user}),
    );
    const restored = await bootAccount({platform: 'ios'});
    expect(restored).toEqual({status: 'authenticated', user});
    expect(
      mockFetch.mock.calls.some(([url]) =>
        (url as string).endsWith('/v1/auth/bootstrap'),
      ),
    ).toBe(false);
  });
});

describe('submitOnboardingName idempotency (SETE-303 / T6)', () => {
  async function bootToTicket(): Promise<string> {
    mockFetch.mockResolvedValueOnce(ticketResponse());
    const result = await bootAccount({
      platform: 'ios',
      randomUuid: () => FALLBACK_UUID,
    });
    expect(result.status).toBe('needs-onboarding');
    if (result.status !== 'needs-onboarding') {
      throw new Error('expected a bootstrap ticket');
    }
    return result.bootstrapTicket;
  }

  function readSignupKeySetting(): string | null {
    const db = getDatabase();
    const result = db.execute(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [SIGNUP_IDEMPOTENCY_KEY],
    );
    const row = result.rows?.item(0) as {value?: string} | undefined;
    return row?.value ?? null;
  }

  function idempotencyKeys(): Array<string | undefined> {
    return mockFetch.mock.calls
      .filter(([url]) => (url as string).endsWith('/v1/users'))
      .map(
        ([, init]) => (init as RequestInit).headers as Record<string, string>,
      )
      .map(headers => headers['Idempotency-Key']);
  }

  it('replays the same Idempotency-Key when creation is retried', async () => {
    const ticket = await bootToTicket();
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(
      submitOnboardingName({bootstrapTicket: ticket, displayName: 'An'}),
    ).resolves.toEqual({status: 'offline'});

    mockFetch.mockResolvedValueOnce(createdResponse());
    await expect(
      submitOnboardingName({bootstrapTicket: ticket, displayName: 'An'}),
    ).resolves.toEqual({status: 'authenticated', user});

    const keys = idempotencyKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it('converges on the existing account after a 409 conflict', async () => {
    const ticket = await bootToTicket();
    mockFetch.mockResolvedValueOnce(
      jsonResponse(409, {
        request_id: 'c3',
        status: 'failed',
        error: {code: 'IDEMPOTENCY_CONFLICT', message: 'conflict'},
      }),
    );
    // Re-bootstrap finds the account created by the racing request.
    mockFetch.mockResolvedValueOnce(authenticatedResponse());
    await expect(
      submitOnboardingName({bootstrapTicket: ticket, displayName: 'An'}),
    ).resolves.toEqual({status: 'authenticated', user});
    expect(bootstrapBodies()).toHaveLength(2);
  });

  it('retains the idempotency key when session persistence fails after createUser', async () => {
    const ticket = await bootToTicket();
    mockFetch.mockResolvedValueOnce(createdResponse());
    const persistSpy = jest
      .spyOn(authSession, 'persistNewSession')
      .mockResolvedValueOnce({ok: false, error: new Error('keychain')});
    getDatabase().execute('DELETE FROM app_settings WHERE key = ?;', [
      'account.install_completed_v1',
    ]);
    expect(hasInstallMarker()).toBe(false);
    await expect(
      submitOnboardingName({bootstrapTicket: ticket, displayName: 'An'}),
    ).resolves.toMatchObject({
      status: 'failed',
      code: 'KEYCHAIN_ERROR',
      retryable: true,
    });
    expect(hasInstallMarker()).toBe(false);
    expect(readSignupKeySetting()).toBeTruthy();
    persistSpy.mockRestore();
    mockFetch.mockResolvedValueOnce(createdResponse());
    await expect(
      submitOnboardingName({bootstrapTicket: ticket, displayName: 'An'}),
    ).resolves.toEqual({status: 'authenticated', user});
    const keys = idempotencyKeys();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(hasInstallMarker()).toBe(true);
    expect(readSignupKeySetting()).toBeNull();
  });

  it('clears the signup key and sets the install marker only after a successful apply', async () => {
    const ticket = await bootToTicket();
    getDatabase().execute('DELETE FROM app_settings WHERE key = ?;', [
      'account.install_completed_v1',
    ]);
    mockFetch.mockResolvedValueOnce(createdResponse());
    await expect(
      submitOnboardingName({bootstrapTicket: ticket, displayName: 'An'}),
    ).resolves.toEqual({status: 'authenticated', user});
    expect(hasInstallMarker()).toBe(true);
    expect(readSignupKeySetting()).toBeNull();
  });
});

describe('accountBootstrap lesson quarantine (Checkpoint A)', () => {
  const realLegacyClear = jest.requireActual('../../db/legacyClear') as {
    executeLegacyClear: () => Promise<void>;
    executeCanonicalLegacyClear: (opts: {
      authorizationRef: string;
    }) => Promise<any>;
    CANONICAL_LEGACY_CLEAR_MARKER: string;
  };

  const V1_LESSON_ID = 'lesson-v1-1';
  const V2_LESSON_ID = 'lesson-v2-1';
  const CREATED_AT = '2026-09-14T00:00:00.000Z';
  const V2_TABLES = [
    'lesson_v2',
    'lesson_v2_sentences',
    'lesson_v2_chunks',
    'lesson_v2_vocabulary',
    'lesson_v2_grammar',
    'lesson_v2_units',
  ];

  function seedLessonFixtures(): void {
    const db = getDatabase();
    db.execute(
      'INSERT INTO lessons (id, anonymous_user_id, lesson_input_hash, title, source_type, confirmed_text, vietnamese_translation, level, ai_output_json, is_saved, created_at, updated_at, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        V1_LESSON_ID,
        'anon1',
        'hash1',
        'title',
        'paste_text',
        'text',
        'trans',
        'A1',
        '{}',
        0,
        CREATED_AT,
        CREATED_AT,
        'vocabulary',
      ],
    );
    db.execute(
      `INSERT OR REPLACE INTO lesson_v2 (
        lesson_id, anonymous_user_id, input_hash, schema_version, request_id,
        status, revision, source_text, word_count, char_count,
        detected_language, title, level, prompt_version, is_saved,
        warnings_json, error_json, practice_json, expires_at, created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        V2_LESSON_ID,
        'anon1',
        'hash-v2',
        1,
        'req-1',
        'ready',
        1,
        'hello world',
        2,
        11,
        'en',
        'v2 title',
        'A1',
        'pv1',
        0,
        '[]',
        null,
        '{}',
        null,
        CREATED_AT,
        CREATED_AT,
      ],
    );
    db.execute(
      'INSERT INTO lesson_v2_sentences (lesson_id, sentence_id, idx, text, char_start, char_end, chunk_id, status, translation, simple_meaning, phrases_json, tts_json, related_vocabulary_ids_json, related_grammar_ids_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        V2_LESSON_ID,
        's1',
        0,
        'hello',
        0,
        5,
        'c1',
        'ready',
        'xin chào',
        'chào',
        '[]',
        '{}',
        '[]',
        '[]',
        CREATED_AT,
      ],
    );
    db.execute(
      'INSERT INTO lesson_v2_chunks (lesson_id, chunk_id, idx, sentence_ids_json, status, attempts, error_code, retryable) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      [V2_LESSON_ID, 'c1', 0, '["s1"]', 'ready', 1, null, 0],
    );
    db.execute(
      'INSERT INTO lesson_v2_vocabulary (lesson_id, vocab_id, word, phrase_from_text, word_type, meaning_vi, ipa, ipa_source, source_sentence_id, example, example_translation, tts_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        V2_LESSON_ID,
        'w1',
        'hello',
        'hello',
        'interjection',
        'xin chào',
        'həˈloʊ',
        'ai',
        's1',
        'hello!',
        'xin chào!',
        '{}',
      ],
    );
    db.execute(
      'INSERT INTO lesson_v2_grammar (lesson_id, grammar_id, name, name_vi, pattern, found_in_sentence_id, found_in_text, explanation_vi, beginner_tip, examples_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        V2_LESSON_ID,
        'g1',
        'greeting',
        'chào hỏi',
        'hello',
        's1',
        'hello',
        'lời chào',
        'tip',
        '[]',
      ],
    );
    db.execute(
      'INSERT INTO lesson_v2_units (lesson_id, unit_key, status, attempts, error_code, retryable) VALUES (?, ?, ?, ?, ?, ?);',
      [V2_LESSON_ID, 'vocabulary', 'ready', 1, null, 0],
    );
  }

  function lessonRowCounts(): Record<string, number> {
    const db = getDatabase();
    const counts: Record<string, number> = {
      lessons:
        db.execute('SELECT * FROM lessons ORDER BY datetime(created_at) DESC;')
          .rows?.length ?? 0,
    };
    for (const table of V2_TABLES) {
      counts[table] =
        db.execute(`SELECT * FROM ${table} WHERE lesson_id = ?;`, [
          V2_LESSON_ID,
        ]).rows?.length ?? 0;
    }
    return counts;
  }

  function expectLessonsIntact(counts: Record<string, number>): void {
    for (const table of ['lessons', ...V2_TABLES]) {
      expect(counts[table]).toBe(1);
    }
  }

  function canonicalMarkerCount(): number {
    const result = getDatabase().execute(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?;',
      [realLegacyClear.CANONICAL_LEGACY_CLEAR_MARKER],
    );
    return result.rows?.item(0)?.count ?? 0;
  }

  beforeEach(() => {
    resetBootStateForTests();
    // Route boot through the REAL legacy clear so these tests pin what
    // generic account boot actually does to lesson rows pre-parity.
    (executeLegacyClear as unknown as jest.Mock).mockImplementation(() =>
      realLegacyClear.executeLegacyClear(),
    );
    (executeCanonicalLegacyClear as unknown as jest.Mock).mockImplementation(
      opts => realLegacyClear.executeCanonicalLegacyClear(opts),
    );
  });

  afterEach(() => {
    (executeLegacyClear as unknown as jest.Mock).mockResolvedValue(undefined);
    (executeCanonicalLegacyClear as unknown as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  it('fresh-install boot preserves populated v1/v2 lesson rows', async () => {
    seedLessonFixtures();
    expectLessonsIntact(lessonRowCounts());
    mockFetch.mockResolvedValue(ticketResponse());

    const result = await bootAccount({
      platform: 'ios',
      randomUuid: () => FALLBACK_UUID,
    });

    expect(result.status).toBe('needs-onboarding');
    expect(executeLegacyClear).toHaveBeenCalled();
    expectLessonsIntact(lessonRowCounts());
    expect(canonicalMarkerCount()).toBe(0);
    expect(hasInstallMarker()).toBe(true);
  });

  it('repeated boots preserve lesson rows', async () => {
    seedLessonFixtures();
    mockFetch.mockResolvedValue(ticketResponse());

    await bootAccount({platform: 'ios', randomUuid: () => FALLBACK_UUID});
    resetBootStateForTests();
    const result = await bootAccount({
      platform: 'ios',
      randomUuid: () => FALLBACK_UUID,
    });

    expect(result.status).toBe('needs-onboarding');
    expectLessonsIntact(lessonRowCounts());
    expect(canonicalMarkerCount()).toBe(0);
  });

  it('session-restore boot preserves lesson rows without bootstrapping', async () => {
    mockFetch.mockResolvedValueOnce(ticketResponse());
    await bootAccount({platform: 'ios', randomUuid: () => FALLBACK_UUID});
    resetBootStateForTests();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(createdResponse());
    const submitted = await submitOnboardingName({
      bootstrapTicket: 'bt_ticket_1',
      displayName: 'An',
    });
    expect(submitted.status).toBe('authenticated');

    seedLessonFixtures();
    // Simulate an install that never ran the generic clear: the restore boot
    // below must still preserve lesson rows.
    getDatabase().execute('DELETE FROM app_settings WHERE key = ?;', [
      'account.legacy_clear_completed_v1',
    ]);
    resetBootStateForTests();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {request_id: 'm1', status: 'success', user}),
    );

    const restored = await bootAccount({platform: 'ios'});

    expect(restored).toEqual({status: 'authenticated', user});
    expect(
      mockFetch.mock.calls.some(([url]) =>
        (url as string).endsWith('/v1/auth/bootstrap'),
      ),
    ).toBe(false);
    expectLessonsIntact(lessonRowCounts());
    expect(canonicalMarkerCount()).toBe(0);
  });

  it('a pre-existing old marker is not treated as canonical cleanup evidence', async () => {
    seedLessonFixtures();
    getDatabase().execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['account.legacy_clear_completed_v1', '1', CREATED_AT],
    );
    mockFetch.mockResolvedValue(ticketResponse());

    const result = await bootAccount({
      platform: 'ios',
      randomUuid: () => FALLBACK_UUID,
    });

    expect(result.status).toBe('needs-onboarding');
    expectLessonsIntact(lessonRowCounts());
    expect(canonicalMarkerCount()).toBe(0);
  });

  it('authorized boot cleanup drops legacy lesson tables and writes canonical marker', async () => {
    seedLessonFixtures();
    mockFetch.mockResolvedValue(ticketResponse());

    const result = await bootAccount({
      platform: 'ios',
      randomUuid: () => FALLBACK_UUID,
      canonicalCleanupAuthRef: '01a0de32-7f74-7145-a78f-a546b4b5d54b',
    });

    expect(result.status).toBe('needs-onboarding');
    expect(executeCanonicalLegacyClear).toHaveBeenCalledWith({
      authorizationRef: '01a0de32-7f74-7145-a78f-a546b4b5d54b',
    });
    expect(canonicalMarkerCount()).toBe(1);
  });
});
