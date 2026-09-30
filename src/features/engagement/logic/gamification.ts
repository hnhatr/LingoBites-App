import {listGamificationEvents} from './data/GamificationRepository';
import type {GamificationSnapshot} from './gamificationPolicy';
import {deriveGamificationSnapshot} from './gamificationPolicy';

/**
 * Loads the current gamification snapshot by recomputing it from the persisted
 * event log (ADR-4). Recomputed fresh on every call, so after a force-quit and
 * relaunch the same events reproduce the same streak/XP/badge/pet state (VC-6)
 * and nothing is ever held only in transient UI state.
 */
export function getGamificationSnapshot(
  today = new Date(),
): GamificationSnapshot {
  return deriveGamificationSnapshot(listGamificationEvents(), today);
}
