import {
  cancelAccountSwitchAttempt,
  confirmAccountSwitchAttempt,
  readCurrentAccountSwitchAttempt,
  recoverAccountSwitchAttempt,
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
} from '../accountSwitchCoordinator';
import {
  readAccountSwitchJournal,
  writeAccountSwitchJournal,
  type AccountSwitchAttemptV1,
} from '../accountSwitchJournal';
import type {AuthUser} from '../authTypes';
import {installKeychainVault} from '@test/support/keychainVault';

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

const userC: AuthUser = {
  id: '33333333-3333-4333-8333-333333333333',
  public_code: 'LB-CCCC',
  display_name: 'User C',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-28T00:00:00.000Z',
  updated_at: '2026-09-28T00:00:00.000Z',
};

const ownershipAB = {
  sourceAccountId: userA.id,
  targetAccountId: userB.id,
};

const fixedNow = '2026-09-28T02:00:00.000Z';
let attemptCounter = 0;

function stageInput(target: AuthUser = userB) {
  return {
    ...ownershipAB,
    targetAccountId: target.id,
    targetSessionId: '44444444-4444-4444-8444-444444444444',
    targetUserSnapshot: target,
    now: () => fixedNow,
    newAttemptId: () => `attempt-${++attemptCounter}`,
  };
}

beforeEach(() => {
  installKeychainVault();
  resetAccountSwitchCoordinatorForTests();
  attemptCounter = 0;
});

describe('accountSwitchCoordinator stage/confirm/cancel', () => {
  it('stages an awaiting attempt durably', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    expect(staged.value.phase).toBe('awaiting');
    await expect(readAccountSwitchJournal()).resolves.toEqual({
      ok: true,
      value: staged.value,
    });
  });

  it('rejects confirm with a stale attempt id (INV-001 wrong attempt)', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    const result = await confirmAccountSwitchAttempt('wrong-id', ownershipAB);
    expect(result).toEqual({ok: false, errorCode: 'STALE_ATTEMPT_ID'});
  });

  it('rejects confirm when ownership does not match journal (INV-001)', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    const result = await confirmAccountSwitchAttempt(staged.value.attempt_id, {
      sourceAccountId: userA.id,
      targetAccountId: userC.id,
    });
    expect(result).toEqual({ok: false, errorCode: 'OWNERSHIP_MISMATCH'});
  });

  it('confirms the exact attempt and is idempotent on duplicate confirm', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    const first = await confirmAccountSwitchAttempt(
      staged.value.attempt_id,
      ownershipAB,
    );
    expect(first.ok).toBe(true);
    const second = await confirmAccountSwitchAttempt(
      staged.value.attempt_id,
      ownershipAB,
    );
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.phase).toBe('confirmed');
      expect(second.value.confirmed_at).toBe(first.value.confirmed_at);
    }
  });

  it('cancels only the matching awaiting attempt', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    await expect(
      cancelAccountSwitchAttempt(staged.value.attempt_id),
    ).resolves.toEqual({ok: true, value: undefined});
    await expect(readCurrentAccountSwitchAttempt()).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('refuses to replace a confirmed attempt with a new target (INV-001)', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    await confirmAccountSwitchAttempt(staged.value.attempt_id, ownershipAB);
    const replacement = await stageAccountSwitchAttempt({
      ...stageInput(userC),
      sourceAccountId: userA.id,
      targetAccountId: userC.id,
    });
    expect(replacement).toEqual({
      ok: false,
      errorCode: 'CONFIRMED_ATTEMPT_LOCKED',
    });
  });

  it('allows a new target to replace an awaiting attempt', async () => {
    const first = await stageAccountSwitchAttempt(stageInput());
    expect(first.ok).toBe(true);
    const second = await stageAccountSwitchAttempt(stageInput(userC));
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.target_account_id).toBe(userC.id);
      expect(second.value.attempt_id).not.toBe(
        first.ok ? first.value.attempt_id : '',
      );
    }
  });

  it('CR-001: rejects staging when the new attempt id equals the replaced awaiting id', async () => {
    const first = await stageAccountSwitchAttempt({
      ...stageInput(),
      newAttemptId: () => 'fixed-attempt-id',
    });
    expect(first.ok).toBe(true);
    const second = await stageAccountSwitchAttempt({
      ...stageInput(userC),
      newAttemptId: () => 'fixed-attempt-id',
    });
    expect(second).toEqual({ok: false, errorCode: 'DUPLICATE_ATTEMPT_ID'});
  });

  it('CR-002: rejects staging when target account id disagrees with snapshot id', async () => {
    const result = await stageAccountSwitchAttempt({
      ...stageInput(userB),
      targetAccountId: userC.id,
    });
    expect(result).toEqual({ok: false, errorCode: 'OWNERSHIP_MISMATCH'});
    await expect(readCurrentAccountSwitchAttempt()).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('rejects cancel on a confirmed attempt', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    await confirmAccountSwitchAttempt(staged.value.attempt_id, ownershipAB);
    await expect(
      cancelAccountSwitchAttempt(staged.value.attempt_id),
    ).resolves.toEqual({ok: false, errorCode: 'CONFIRMED_ATTEMPT_LOCKED'});
  });
});

describe('accountSwitchCoordinator recover (restart reconstruction)', () => {
  async function seedAttempt(attempt: AccountSwitchAttemptV1) {
    await writeAccountSwitchJournal(attempt);
  }

  it('returns awaiting_confirmation when DB still reflects source A', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userA.id,
      activeSessionUserId: userA.id,
      dbCommittedToTarget: false,
    });
    expect(recovery.ok).toBe(true);
    if (recovery.ok) {
      expect(recovery.value.kind).toBe('awaiting_confirmation');
    }
  });

  it('returns confirmed_retry_wipe after restart before DB wipe (INV-002)', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    await confirmAccountSwitchAttempt(staged.value.attempt_id, ownershipAB);
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userA.id,
      activeSessionUserId: userA.id,
      dbCommittedToTarget: false,
    });
    expect(recovery).toEqual({
      ok: true,
      value: {
        kind: 'confirmed_retry_wipe',
        attempt: expect.objectContaining({phase: 'confirmed'}),
      },
    });
  });

  it('returns confirmed_activate when DB committed to B but pointer pending (INV-003)', async () => {
    await seedAttempt({
      version: 1,
      attempt_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      source_account_id: userA.id,
      target_account_id: userB.id,
      target_session_id: '44444444-4444-4444-8444-444444444444',
      target_user_snapshot: userB,
      phase: 'confirmed',
      created_at: fixedNow,
      updated_at: fixedNow,
      confirmed_at: fixedNow,
    });
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userB.id,
      activeSessionUserId: userA.id,
      dbCommittedToTarget: true,
    });
    expect(recovery.ok).toBe(true);
    if (recovery.ok) {
      expect(recovery.value.kind).toBe('confirmed_activate');
    }
  });

  it('clears an orphaned journal when B is already active with matching DB', async () => {
    await seedAttempt({
      version: 1,
      attempt_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      source_account_id: userA.id,
      target_account_id: userB.id,
      target_session_id: '44444444-4444-4444-8444-444444444444',
      target_user_snapshot: userB,
      phase: 'confirmed',
      created_at: fixedNow,
      updated_at: fixedNow,
      confirmed_at: fixedNow,
    });
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userB.id,
      activeSessionUserId: userB.id,
      dbCommittedToTarget: true,
    });
    expect(recovery).toEqual({
      ok: true,
      value: {kind: 'cleared_stale_journal'},
    });
    await expect(readAccountSwitchJournal()).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('CR-004: rejects recovery when an unrelated account is active before DB commit', async () => {
    const staged = await stageAccountSwitchAttempt(stageInput());
    expect(staged.ok).toBe(true);
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userA.id,
      activeSessionUserId: userC.id,
      dbCommittedToTarget: false,
    });
    expect(recovery).toEqual({
      ok: true,
      value: {kind: 'invalid_journal', errorCode: 'INVALID_JOURNAL'},
    });
  });

  it('classifies corrupt journal bytes as invalid_journal', async () => {
    const Keychain = jest.requireMock('react-native-keychain') as {
      setGenericPassword: jest.Mock;
    };
    await Keychain.setGenericPassword('account-switch-attempt', '{bad', {
      service: 'com.lingobites.auth.account-switch',
    });
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userA.id,
      activeSessionUserId: userA.id,
      dbCommittedToTarget: false,
    });
    expect(recovery.ok).toBe(true);
    if (recovery.ok) {
      expect(recovery.value.kind).toBe('invalid_journal');
    }
  });
});

describe('accountSwitchCoordinator single-flight ordering', () => {
  it('serializes concurrent stage operations (NFR-006)', async () => {
    const results = await Promise.all([
      stageAccountSwitchAttempt(stageInput()),
      stageAccountSwitchAttempt(stageInput()),
      stageAccountSwitchAttempt(stageInput()),
    ]);
    const okResults = results.filter(r => r.ok);
    expect(okResults.length).toBeGreaterThan(0);
    const journal = await readAccountSwitchJournal();
    expect(journal.ok).toBe(true);
    if (journal.ok) {
      expect(journal.value).not.toBeNull();
    }
  });
});
