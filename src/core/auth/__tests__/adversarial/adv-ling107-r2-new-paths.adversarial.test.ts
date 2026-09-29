import {vault, installKeychainVault} from '@test/support/keychainVault';
import {
  confirmAccountSwitchAttempt,
  recoverAccountSwitchAttempt,
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '../../accountSwitchCoordinator';
import {
  ACCOUNT_SWITCH_JOURNAL_SERVICE,
  readAccountSwitchJournal,
} from '../../accountSwitchJournal';
import type {AuthUser} from '../../authTypes';

/**
 * LING-107 adversarial delta re-review r2: attacks the repair paths
 * (DUPLICATE_ATTEMPT_ID, snapshot allowlist, active-session classification).
 * Keychain is the in-memory vault double; device Keychain NOT VERIFIED (R5).
 */

function makeUser(id: string, name: string): AuthUser {
  return {
    id,
    public_code: `LB-${name}`,
    display_name: `User ${name}`,
    phone_e164: null,
    status: 'active',
    created_at: '2026-09-28T00:00:00.000Z',
    updated_at: '2026-09-28T00:00:00.000Z',
  };
}

const userA = makeUser('11111111-1111-4111-8111-111111111111', 'AAAA');
const userB = makeUser('22222222-2222-4222-8222-222222222222', 'BBBB');
const userC = makeUser('33333333-3333-4333-8333-333333333333', 'CCCC');
const ownershipAB = {sourceAccountId: userA.id, targetAccountId: userB.id};

function input(id: string, snapshot: AuthUser = userB, session = 'sess-B') {
  return {
    ...ownershipAB,
    targetSessionId: session,
    targetUserSnapshot: snapshot,
    newAttemptId: () => id,
  };
}

beforeEach(() => {
  installKeychainVault();
  resetAccountSwitchCoordinatorForTests();
});

it('HELD r2 / INV-001: a forced duplicate attempt id cannot replace the awaiting attempt', async () => {
  expect((await stageAccountSwitchAttempt(input('dup', userB, 's1'))).ok).toBe(
    true,
  );
  const second = await stageAccountSwitchAttempt(input('dup', userB, 's2'));
  expect(second).toEqual({ok: false, errorCode: 'DUPLICATE_ATTEMPT_ID'});
  const read = await readAccountSwitchJournal();
  expect(read.ok && read.value?.target_session_id).toBe('s1');
  expect(read.ok && read.value?.phase).toBe('awaiting');
});

it('HELD r2 / INV-001: 200 default attempt ids at a frozen clock without crypto are unique', async () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', {
    value: undefined,
    configurable: true,
  });
  const spy = jest.spyOn(Date, 'now').mockReturnValue(1790000000000);
  try {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = await stageAccountSwitchAttempt({
        ...ownershipAB,
        targetSessionId: `s-${i}`,
        targetUserSnapshot: userB,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        ids.add(r.value.attempt_id);
      }
    }
    expect(ids.size).toBe(200);
  } finally {
    spy.mockRestore();
    Object.defineProperty(globalThis, 'crypto', desc);
  }
});

it('HELD r2 / INV-003: token-like snapshot extras are never persisted and journal stays readable', async () => {
  const dirty = {
    ...userB,
    accessToken: 'SECRET',
    token: 'SECRET2',
    nested: {refreshToken: 'x'},
  } as unknown as AuthUser;
  const staged = await stageAccountSwitchAttempt(input('clean', dirty));
  expect(staged.ok).toBe(true);
  const raw = vault.get(ACCOUNT_SWITCH_JOURNAL_SERVICE)!.password;
  expect(raw).not.toMatch(/SECRET|refreshToken|accessToken/);
  expect((await confirmAccountSwitchAttempt('clean', ownershipAB)).ok).toBe(
    true,
  );
});

it('HELD r2 / INV-003: target-mismatched snapshot is rejected before any journal write', async () => {
  const r = await stageAccountSwitchAttempt(input('mm', userC));
  expect(r).toEqual({ok: false, errorCode: 'OWNERSHIP_MISMATCH'});
  expect(vault.has(ACCOUNT_SWITCH_JOURNAL_SERVICE)).toBe(false);
});

it('HELD r2 / INV-003: active-session matrix never yields wipe/activate for a foreign or premature session', async () => {
  await stageAccountSwitchAttempt(input('m'));
  const awaitingCases = [
    {local: userA.id, active: userB.id, db: false},
    {local: userA.id, active: userC.id, db: false},
    {local: userA.id, active: userC.id, db: true},
  ];
  for (const c of awaitingCases) {
    const r = await recoverAccountSwitchAttempt({
      localAccountId: c.local,
      activeSessionUserId: c.active,
      dbCommittedToTarget: c.db,
    });
    expect(r.ok && r.value.kind).toBe('invalid_journal');
  }
  await confirmAccountSwitchAttempt('m', ownershipAB);
  const confirmedCases = [
    {local: userA.id, active: userB.id, db: false, ok: 'invalid_journal'},
    {local: userA.id, active: userC.id, db: false, ok: 'invalid_journal'},
    {local: userB.id, active: userC.id, db: true, ok: 'invalid_journal'},
    {local: userA.id, active: userA.id, db: false, ok: 'confirmed_retry_wipe'},
    {local: userA.id, active: null, db: false, ok: 'confirmed_retry_wipe'},
    {local: userB.id, active: userA.id, db: true, ok: 'confirmed_activate'},
  ];
  for (const c of confirmedCases) {
    const r = await recoverAccountSwitchAttempt({
      localAccountId: c.local,
      activeSessionUserId: c.active,
      dbCommittedToTarget: c.db,
    });
    expect(r.ok && r.value.kind).toBe(c.ok);
  }
});
