import type {AccountPhase} from '@modules/account';

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
