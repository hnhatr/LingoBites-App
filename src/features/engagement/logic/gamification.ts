import {listGamificationEvents} from './data/GamificationRepository';
import type {GamificationSnapshot} from './gamificationPolicy';
import {deriveGamificationSnapshot} from './gamificationPolicy';
import {getWeeklyGoalState} from './weeklyGoal';

/**
 * Loads the current gamification snapshot by recomputing it from the persisted
 * event log (ADR-4). Recomputed fresh on every call, so after a force-quit and
 * relaunch the same events reproduce the same streak/XP/badge/pet state (VC-6)
 * and nothing is ever held only in transient UI state.
 */
export function getGamificationSnapshot(
  today = new Date(),
): GamificationSnapshot {
  const base = deriveGamificationSnapshot(listGamificationEvents(), today);
  const weekly = getWeeklyGoalState(today);
  const badges = [...base.badges];
  if (weekly.badgeEarned && !badges.some(badge => badge.id === 'diligent')) {
    badges.push({id: 'diligent'});
  }
  return {
    ...base,
    weeklyGoal: {
      completedThisWeek: weekly.completedThisWeek,
      target: weekly.target,
    },
    badges,
  };
}
