import type {AccountPhase} from '@features/account';
import type {LearnerProfileStatus} from '@features/onboarding';

/**
 * Deterministic account gate mapping (SETE-303 / T6): exactly one root
 * route per account phase. `AppNavigator` renders from this helper so the
 * phase → screen contract is unit-testable without mounting a navigator.
 *
 * `signed-out` is an explicit post-logout gate: it renders BootGate with a
 * Continue action and never auto-boots, so logout stays observable until
 * the user (or a fresh process) rejoins the normal boot path.
 */
export function accountGateRouteForPhase(
  phase: AccountPhase,
): 'BootGate' | 'Onboarding' | 'AccountSwitch' | 'Tabs' {
  if (phase === 'authenticated') {
    return 'Tabs';
  }
  if (phase === 'needs-onboarding') {
    return 'Onboarding';
  }
  if (
    phase === 'switch-confirmation' ||
    phase === 'switching' ||
    phase === 'switch-failed'
  ) {
    return 'AccountSwitch';
  }
  if (phase === 'signed-out') {
    return 'BootGate';
  }
  return 'BootGate';
}

/**
 * A signed-in learner whose profile has not loaded yet: `AppNavigator` holds
 * `Tabs` back and the launch gate keeps covering the app until it resolves.
 */
export function isLearnerProfilePending(
  profileStatus: LearnerProfileStatus,
  userId: string | null,
): boolean {
  return profileStatus === 'checking' || (profileStatus === 'idle' && !!userId);
}
