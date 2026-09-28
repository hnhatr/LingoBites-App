import * as Keychain from 'react-native-keychain';
import {
  cancelAccountSwitchAttempt,
  confirmAccountSwitchAttempt,
  readCurrentAccountSwitchAttempt,
  recoverAccountSwitchAttempt,
  resetAccountSwitchCoordinatorForTests,
  stageAccountSwitchAttempt,
  type StageAccountSwitchInput,
} from '../../accountSwitchCoordinator';
import {
  readAccountSwitchJournal,
  writeAccountSwitchJournal,
  type AccountSwitchAttemptV1,
} from '../../accountSwitchJournal';
import type {AuthUser} from '../../authTypes';
import {installKeychainVault} from '@/test-support/keychainVault';

/**
 * LING-107 adversarial review (INV-001 / INV-002 / INV-003) of the TASK-019
 * account-switch journal + coordinator. Only the Keychain native module is
 * doubled (in-memory vault, optionally with injected latency/failure); the
 * coordinator, journal parser and single-flight queue run unmodified.
 * Device Keychain behaviour is NOT covered here (R5 — deferred to M4 QA).
 */

const keychain = Keychain as jest.Mocked<typeof Keychain>;

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

function input(
  target: AuthUser,
  targetSessionId: string,
  overrides: Partial<StageAccountSwitchInput> = {},
): StageAccountSwitchInput {
  return {
    sourceAccountId: userA.id,
    targetAccountId: target.id,
    targetSessionId,
    targetUserSnapshot: target,
    ...overrides,
  };
}

async function journal(): Promise<AccountSwitchAttemptV1 | null> {
  const read = await readAccountSwitchJournal();
  if (!read.ok) {
    throw new Error(`journal unreadable: ${read.errorCode}`);
  }
  return read.value;
}

/** Adds random async latency to every Keychain call (real I/O is async). */
function addKeychainLatency(): void {
  const delay = () =>
    new Promise(resolve => setTimeout(resolve, Math.random() * 3));
  const get = keychain.getGenericPassword.getMockImplementation()!;
  const set = keychain.setGenericPassword.getMockImplementation()!;
  const reset = keychain.resetGenericPassword.getMockImplementation()!;
  keychain.getGenericPassword.mockImplementation(async options => {
    await delay();
    return get(options);
  });
  keychain.setGenericPassword.mockImplementation(
    async (username, password, options) => {
      await delay();
      return set(username, password, options);
    },
  );
  keychain.resetGenericPassword.mockImplementation(async options => {
    await delay();
    return reset(options);
  });
}

beforeEach(() => {
  installKeychainVault();
  resetAccountSwitchCoordinatorForTests();
});

describe('ADV-001 / INV-001 / INV-003: attempt identity without crypto.randomUUID', () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto',
  )!;

  beforeEach(() => {
    // Hermes (hermesEnabled=true, RN 0.85) exposes no Web Crypto and the app
    // installs no polyfill, so production takes the default-ID fallback.
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    jest.restoreAllMocks();
  });

  it('ADV-001 / INV-001: a stale confirm from a replaced attempt must not confirm the replacement (same clock ms)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1790000000000);

    // Prompt #1: A→B with candidate session S1.
    const first = await stageAccountSwitchAttempt(
      input(userB, 'session-S1-0000'),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    // Login to B is retried, a new candidate session S2 replaces the awaiting
    // attempt; the user has NOT confirmed attempt #2.
    const second = await stageAccountSwitchAttempt(
      input(userB, 'session-S2-0000'),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    // The stale callback from prompt #1 fires.
    const stale = await confirmAccountSwitchAttempt(
      first.value.attempt_id,
      ownershipAB,
    );

    // Invariant: only an explicit confirmation of THIS attempt may authorise
    // the wipe. The replacement must still be awaiting.
    expect(stale).toEqual({ok: false, errorCode: 'STALE_ATTEMPT_ID'});
    expect((await journal())?.phase).toBe('awaiting');
    expect(second.value.attempt_id).not.toBe(first.value.attempt_id);
  });

  it('ADV-001 / INV-001: cancel + restage after a device clock rewind must yield a fresh attempt id', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1790000000000);
    const first = await stageAccountSwitchAttempt(
      input(userB, 'session-S1-0000'),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    await cancelAccountSwitchAttempt(first.value.attempt_id);

    // Time passes, then the user moves the device clock back to the same ms.
    clock.mockReturnValue(1790000000000);
    const second = await stageAccountSwitchAttempt(
      input(userB, 'session-S2-0000'),
    );
    expect(second.ok).toBe(true);

    const stale = await confirmAccountSwitchAttempt(
      first.value.attempt_id,
      ownershipAB,
    );
    expect(stale.ok).toBe(false);
    expect((await journal())?.phase).toBe('awaiting');
  });
});

describe('ADV-002 / INV-003: recovery must not classify an unrelated active session as a safe state', () => {
  async function seed(phase: 'awaiting' | 'confirmed'): Promise<void> {
    const staged = await stageAccountSwitchAttempt(
      input(userB, 'session-B-00000', {newAttemptId: () => 'attempt-adv-002'}),
    );
    expect(staged.ok).toBe(true);
    if (phase === 'confirmed') {
      const confirmed = await confirmAccountSwitchAttempt(
        'attempt-adv-002',
        ownershipAB,
      );
      expect(confirmed.ok).toBe(true);
    }
  }

  it('ADV-002 / INV-003: awaiting A→B journal with account C active is mismatched, not a prompt', async () => {
    await seed('awaiting');
    const result = await recoverAccountSwitchAttempt({
      localAccountId: userA.id,
      activeSessionUserId: userC.id,
      dbCommittedToTarget: false,
    });
    expect(result).toEqual({
      ok: true,
      value: {kind: 'invalid_journal', errorCode: 'INVALID_JOURNAL'},
    });
  });

  it('ADV-002 / INV-003: confirmed A→B journal with account C active must not retry the wipe', async () => {
    await seed('confirmed');
    const result = await recoverAccountSwitchAttempt({
      localAccountId: userA.id,
      activeSessionUserId: userC.id,
      dbCommittedToTarget: false,
    });
    expect(result).toEqual({
      ok: true,
      value: {kind: 'invalid_journal', errorCode: 'INVALID_JOURNAL'},
    });
  });

  it('ADV-002 / INV-003: committed B database with account C active must not activate B', async () => {
    await seed('confirmed');
    const result = await recoverAccountSwitchAttempt({
      localAccountId: userB.id,
      activeSessionUserId: userC.id,
      dbCommittedToTarget: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {kind: 'invalid_journal', errorCode: 'INVALID_JOURNAL'},
    });
  });
});

describe('HELD / INV-001 / INV-003: coordinator gate under replay, races and failures', () => {
  it('HELD / INV-001: stale confirm after cancel cannot resurrect or confirm anything', async () => {
    const staged = await stageAccountSwitchAttempt(
      input(userB, 'session-B-00000'),
    );
    expect(staged.ok).toBe(true);
    if (!staged.ok) {
      return;
    }
    await cancelAccountSwitchAttempt(staged.value.attempt_id);
    const stale = await confirmAccountSwitchAttempt(
      staged.value.attempt_id,
      ownershipAB,
    );
    expect(stale).toEqual({ok: false, errorCode: 'NO_ACTIVE_ATTEMPT'});
    expect(await journal()).toBeNull();
  });

  it('HELD / INV-001: confirm with the right id but wrong target (B→C replacement) is rejected', async () => {
    const staged = await stageAccountSwitchAttempt(
      input(userC, 'session-C-00000', {newAttemptId: () => 'attempt-c'}),
    );
    expect(staged.ok).toBe(true);
    const confirm = await confirmAccountSwitchAttempt('attempt-c', ownershipAB);
    expect(confirm).toEqual({ok: false, errorCode: 'OWNERSHIP_MISMATCH'});
    expect((await journal())?.phase).toBe('awaiting');
  });

  it('HELD / INV-001 / INV-003: 50× concurrent confirm(#1) vs stage(#2) with Keychain latency never confirms an unconfirmed attempt', async () => {
    for (let i = 0; i < 50; i++) {
      installKeychainVault();
      addKeychainLatency();
      resetAccountSwitchCoordinatorForTests();
      const first = await stageAccountSwitchAttempt(
        input(userB, 'session-S1-0000', {newAttemptId: () => `first-${i}`}),
      );
      expect(first.ok).toBe(true);

      const ops: Array<Promise<unknown>> = [];
      const replace = () =>
        stageAccountSwitchAttempt(
          input(i % 3 === 0 ? userC : userB, 'session-S2-0000', {
            newAttemptId: () => `second-${i}`,
          }),
        );
      const confirm = () =>
        confirmAccountSwitchAttempt(`first-${i}`, ownershipAB);
      if (i % 2 === 0) {
        ops.push(confirm(), replace());
      } else {
        ops.push(replace(), confirm());
      }
      await Promise.all(ops);

      const final = await journal();
      if (final?.phase === 'confirmed') {
        // Only the attempt the caller confirmed may ever be confirmed.
        expect(final.attempt_id).toBe(`first-${i}`);
        expect(final.target_session_id).toBe('session-S1-0000');
      } else {
        expect(final?.attempt_id).toBe(`second-${i}`);
        expect(final?.phase).toBe('awaiting');
      }
    }
  });

  it('HELD / INV-001: 20 concurrent duplicate confirms + cancels settle to exactly one terminal state', async () => {
    addKeychainLatency();
    const staged = await stageAccountSwitchAttempt(
      input(userB, 'session-B-00000', {newAttemptId: () => 'dup'}),
    );
    expect(staged.ok).toBe(true);
    const results = await Promise.all(
      Array.from({length: 20}, (_, n) =>
        n % 2 === 0
          ? confirmAccountSwitchAttempt('dup', ownershipAB)
          : cancelAccountSwitchAttempt('dup'),
      ),
    );
    // First queued op is a confirm → confirmed; every cancel must then be locked.
    expect(results[0].ok).toBe(true);
    const final = await journal();
    expect(final?.phase).toBe('confirmed');
    for (let n = 1; n < 20; n += 2) {
      expect(results[n]).toEqual({
        ok: false,
        errorCode: 'CONFIRMED_ATTEMPT_LOCKED',
      });
    }
    const confirmedAts = results
      .filter((_, n) => n % 2 === 0)
      .map(r => (r as {value: AccountSwitchAttemptV1}).value.confirmed_at);
    expect(new Set(confirmedAts).size).toBe(1);
  });

  it('HELD / INV-001: Keychain write failure during confirm leaves the attempt awaiting', async () => {
    const staged = await stageAccountSwitchAttempt(
      input(userB, 'session-B-00000', {newAttemptId: () => 'fail'}),
    );
    expect(staged.ok).toBe(true);
    keychain.setGenericPassword.mockRejectedValueOnce(new Error('keychain io'));
    const confirm = await confirmAccountSwitchAttempt('fail', ownershipAB);
    expect(confirm.ok).toBe(false);
    expect((await journal())?.phase).toBe('awaiting');
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userA.id,
      activeSessionUserId: userA.id,
      dbCommittedToTarget: false,
    });
    expect(recovery.ok && recovery.value.kind).toBe('awaiting_confirmation');
  });

  it('HELD / INV-001 / INV-003: confirmed attempt is never replaced, cancelled, or re-targeted', async () => {
    await stageAccountSwitchAttempt(
      input(userB, 'session-B-00000', {newAttemptId: () => 'locked'}),
    );
    await confirmAccountSwitchAttempt('locked', ownershipAB);
    const results = await Promise.all([
      stageAccountSwitchAttempt(input(userC, 'session-C-00000')),
      stageAccountSwitchAttempt(input(userB, 'session-B-11111')),
      cancelAccountSwitchAttempt('locked'),
    ]);
    for (const r of results) {
      expect(r).toEqual({ok: false, errorCode: 'CONFIRMED_ATTEMPT_LOCKED'});
    }
    const final = await journal();
    expect(final).toMatchObject({
      attempt_id: 'locked',
      target_account_id: userB.id,
      target_session_id: 'session-B-00000',
      phase: 'confirmed',
    });
  });

  it('HELD / INV-001 / INV-003: awaiting journal never recovers into a wipe or activation', async () => {
    await stageAccountSwitchAttempt(
      input(userB, 'session-B-00000', {newAttemptId: () => 'await'}),
    );
    const contexts = [
      {
        localAccountId: userA.id,
        activeSessionUserId: userA.id,
        dbCommittedToTarget: false,
      },
      {
        localAccountId: userA.id,
        activeSessionUserId: null,
        dbCommittedToTarget: false,
      },
      {
        localAccountId: userB.id,
        activeSessionUserId: userB.id,
        dbCommittedToTarget: true,
      },
      {
        localAccountId: null,
        activeSessionUserId: null,
        dbCommittedToTarget: false,
      },
      {
        localAccountId: userA.id,
        activeSessionUserId: userA.id,
        dbCommittedToTarget: true,
      },
    ];
    for (const context of contexts) {
      const result = await recoverAccountSwitchAttempt(context);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        continue;
      }
      expect(['awaiting_confirmation', 'invalid_journal']).toContain(
        result.value.kind,
      );
    }
    expect((await journal())?.phase).toBe('awaiting');
  });

  it('HELD / INV-003: journal whose snapshot identity disagrees with target can never be confirmed or activated', async () => {
    await writeAccountSwitchJournal({
      version: 1,
      attempt_id: 'forged',
      source_account_id: userA.id,
      target_account_id: userB.id,
      target_session_id: 'session-B-00000',
      target_user_snapshot: userC,
      phase: 'confirmed',
      created_at: '2026-09-28T00:00:00.000Z',
      updated_at: '2026-09-28T00:00:00.000Z',
      confirmed_at: '2026-09-28T00:00:00.000Z',
    });
    const recovery = await recoverAccountSwitchAttempt({
      localAccountId: userB.id,
      activeSessionUserId: userA.id,
      dbCommittedToTarget: true,
    });
    expect(recovery).toEqual({
      ok: true,
      value: {kind: 'invalid_journal', errorCode: 'INVALID_PAYLOAD'},
    });
    const confirm = await confirmAccountSwitchAttempt('forged', ownershipAB);
    expect(confirm.ok).toBe(false);
    const current = await readCurrentAccountSwitchAttempt();
    expect(current.ok).toBe(false);
  });
});
