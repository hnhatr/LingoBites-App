import type {AccountPhase} from '@modules/account';
import {accountGateRouteForPhase} from '@/app/navigation/accountGate';
import {
  INGESTION_ROUTE_REQUIREMENTS,
  isIngestionRouteEnabled,
} from '@/app/navigation/ingestionRouteGate';
import {getRootStackRouteNames} from '@/app/navigation/rootStackRoutes';
import type {FeatureKey} from '@/release/feature-registry';

export type NavigationMountSnapshot = {
  accountPhase: AccountPhase;
  accountGateRoute: ReturnType<typeof accountGateRouteForPhase>;
  rootStackRoutes: ReturnType<typeof getRootStackRouteNames>;
  ingestionRoutes: Record<string, boolean>;
};

/**
 * Deterministic pre-migration navigation contract: account phase gate plus
 * release-flag-driven root stack and ingestion routes (no navigator mount).
 */
export function buildNavigationMountSnapshot(
  phase: AccountPhase,
  features: Partial<Record<FeatureKey, boolean>>,
): NavigationMountSnapshot {
  const ingestionRoutes: Record<string, boolean> = {};
  for (const route of Object.keys(INGESTION_ROUTE_REQUIREMENTS)) {
    ingestionRoutes[route] = isIngestionRouteEnabled(route, features);
  }

  return {
    accountPhase: phase,
    accountGateRoute: accountGateRouteForPhase(phase),
    rootStackRoutes: getRootStackRouteNames(features),
    ingestionRoutes,
  };
}
