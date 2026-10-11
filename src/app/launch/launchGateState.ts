import type {AccountPhase} from '@features/account';
import type {LaunchUpdatePhase} from '@features/appUpdate';

import {accountGateRouteForPhase} from '../navigation/accountGate';

export type LaunchGateMessage =
  | 'offline'
  | 'failed'
  | 'merge-in-progress'
  | 'signed-out';

/**
 * What the launch gate shows over the app. `ready` lets the app through;
 * every other state keeps the gate up on the brand background.
 */
export type LaunchGateState =
  | {kind: 'ready'}
  | {kind: 'loading'}
  | {kind: 'update'; progress: number}
  | {kind: 'reloading'}
  | {kind: 'message'; message: LaunchGateMessage};

type LaunchGateInput = {
  updatePhase: LaunchUpdatePhase;
  updateProgress: number;
  accountPhase: AccountPhase;
  /** Signed in, but the learner profile has not loaded yet. */
  profilePending: boolean;
};

/**
 * Single launch gate decision. An OTA download wins over everything (the app
 * is about to reload). Otherwise the gate covers every account phase that
 * routes to `BootGate`, plus the profile load before `Tabs`. The update
 * check alone never blocks, so a slow update server does not delay launch.
 */
export function launchGateStateFor({
  updatePhase,
  updateProgress,
  accountPhase,
  profilePending,
}: LaunchGateInput): LaunchGateState {
  if (updatePhase === 'downloading') {
    return {kind: 'update', progress: updateProgress};
  }
  if (updatePhase === 'reloading') {
    return {kind: 'reloading'};
  }
  const route = accountGateRouteForPhase(accountPhase);
  if (route === 'Tabs') {
    return profilePending ? {kind: 'loading'} : {kind: 'ready'};
  }
  if (route !== 'BootGate') {
    return {kind: 'ready'};
  }
  switch (accountPhase) {
    case 'offline':
    case 'merge-in-progress':
    case 'signed-out':
      return {kind: 'message', message: accountPhase};
    case 'bootstrapping':
      return {kind: 'loading'};
    default:
      return {kind: 'message', message: 'failed'};
  }
}
