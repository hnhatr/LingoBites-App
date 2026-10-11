import type {AccountPhase} from '@features/account';

import {launchGateStateFor} from '../launchGateState';

function stateFor(
  accountPhase: AccountPhase,
  overrides: Partial<Parameters<typeof launchGateStateFor>[0]> = {},
) {
  return launchGateStateFor({
    accountPhase,
    profilePending: false,
    updatePhase: 'done',
    updateProgress: 0,
    ...overrides,
  });
}

describe('launchGateStateFor', () => {
  it('lets the app through once the account reaches Tabs with a profile', () => {
    expect(stateFor('authenticated')).toEqual({kind: 'ready'});
  });

  it('keeps loading while the learner profile is still loading', () => {
    expect(stateFor('authenticated', {profilePending: true})).toEqual({
      kind: 'loading',
    });
  });

  it.each([
    'needs-onboarding',
    'switch-confirmation',
    'switching',
    'switch-failed',
  ] as const)('leaves %s to its own navigator screen', phase => {
    expect(stateFor(phase)).toEqual({kind: 'ready'});
  });

  it('loads while bootstrapping', () => {
    expect(stateFor('bootstrapping')).toEqual({kind: 'loading'});
  });

  it.each(['offline', 'merge-in-progress', 'signed-out', 'failed'] as const)(
    'shows the %s message',
    phase => {
      expect(stateFor(phase)).toEqual({kind: 'message', message: phase});
    },
  );

  it('puts a running OTA download ahead of every account phase', () => {
    expect(
      stateFor('authenticated', {
        updatePhase: 'downloading',
        updateProgress: 0.42,
      }),
    ).toEqual({kind: 'update', progress: 0.42});
    expect(stateFor('failed', {updatePhase: 'reloading'})).toEqual({
      kind: 'reloading',
    });
  });

  it('does not block launch on the update check alone', () => {
    expect(stateFor('authenticated', {updatePhase: 'checking'})).toEqual({
      kind: 'ready',
    });
  });
});
