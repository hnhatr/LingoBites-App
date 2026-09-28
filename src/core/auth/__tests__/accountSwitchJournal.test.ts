import {
  ACCOUNT_SWITCH_JOURNAL_SERVICE,
  clearAccountSwitchJournal,
  parseAccountSwitchAttemptV1,
  readAccountSwitchJournal,
  serializeAccountSwitchAttemptV1,
  writeAccountSwitchJournal,
  type AccountSwitchAttemptV1,
} from '../accountSwitchJournal';
import type {AuthUser} from '../authTypes';
import {installKeychainVault, vault} from '../../../test/support/keychainVault';

const userA: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AAAA',
  display_name: 'User A',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-28T00:00:00.000Z',
  updated_at: '2026-09-28T00:00:00.000Z',
};

const userB: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  public_code: 'LB-BBBB',
  display_name: 'User B',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-28T00:00:00.000Z',
  updated_at: '2026-09-28T00:00:00.000Z',
};

function validAttempt(
  overrides: Partial<AccountSwitchAttemptV1> = {},
): AccountSwitchAttemptV1 {
  return {
    version: 1,
    attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    source_account_id: userA.id,
    target_account_id: userB.id,
    target_session_id: '33333333-3333-4333-8333-333333333333',
    target_user_snapshot: userB,
    phase: 'awaiting',
    created_at: '2026-09-28T01:00:00.000Z',
    updated_at: '2026-09-28T01:00:00.000Z',
    confirmed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  installKeychainVault();
});

describe('accountSwitchJournal parse/serialize', () => {
  it('round-trips a valid awaiting attempt', () => {
    const attempt = validAttempt();
    const parsed = parseAccountSwitchAttemptV1(
      serializeAccountSwitchAttemptV1(attempt),
    );
    expect(parsed).toEqual({ok: true, value: attempt});
  });

  it('rejects unsupported versions', () => {
    const raw = serializeAccountSwitchAttemptV1(
      validAttempt({version: 2 as 1}),
    );
    expect(parseAccountSwitchAttemptV1(raw)).toEqual({
      ok: false,
      errorCode: 'UNSUPPORTED_VERSION',
    });
  });

  it('rejects corrupt JSON', () => {
    expect(parseAccountSwitchAttemptV1('{not-json')).toEqual({
      ok: false,
      errorCode: 'INVALID_JSON',
    });
  });

  it('rejects payloads that embed session tokens (INV-003 token absence)', () => {
    const raw = JSON.stringify({
      ...validAttempt(),
      access_token: 'secret',
    });
    expect(parseAccountSwitchAttemptV1(raw)).toEqual({
      ok: false,
      errorCode: 'CONTAINS_TOKEN',
    });
  });

  it('rejects ownership mismatch between snapshot and target account id', () => {
    const attempt = validAttempt({
      target_user_snapshot: {...userB, id: userA.id},
    });
    expect(
      parseAccountSwitchAttemptV1(serializeAccountSwitchAttemptV1(attempt)),
    ).toEqual({
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
    });
  });
});

describe('accountSwitchJournal Keychain adapter (mock vault)', () => {
  it('writes and reads through the fixed journal service', async () => {
    const attempt = validAttempt();
    await expect(writeAccountSwitchJournal(attempt)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(vault.has(ACCOUNT_SWITCH_JOURNAL_SERVICE)).toBe(true);
    await expect(readAccountSwitchJournal()).resolves.toEqual({
      ok: true,
      value: attempt,
    });
  });

  it('clears the journal record', async () => {
    await writeAccountSwitchJournal(validAttempt());
    await expect(clearAccountSwitchJournal()).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(readAccountSwitchJournal()).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('never persists token fields on write', async () => {
    const poisoned = {
      ...validAttempt(),
      access_token: 'lb_at',
    } as AccountSwitchAttemptV1 & {access_token: string};
    await expect(writeAccountSwitchJournal(poisoned)).resolves.toEqual({
      ok: false,
      errorCode: 'CONTAINS_TOKEN',
    });
  });

  it('CR-003: rejects camelCase token fields inside the target snapshot on parse', () => {
    const raw = JSON.stringify({
      ...validAttempt(),
      target_user_snapshot: {
        ...userB,
        accessToken: 'lb_at',
      },
    });
    expect(parseAccountSwitchAttemptV1(raw)).toEqual({
      ok: false,
      errorCode: 'CONTAINS_TOKEN',
    });
  });

  it('CR-003: strips non-token extras from snapshot on read round-trip', async () => {
    const attempt = validAttempt();
    await writeAccountSwitchJournal({
      ...attempt,
      target_user_snapshot: {
        ...userB,
        extra_metadata: 'harmless',
      } as typeof userB & {extra_metadata: string},
    });
    await expect(readAccountSwitchJournal()).resolves.toEqual({
      ok: true,
      value: attempt,
    });
  });
});
