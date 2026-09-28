import type {GamificationEventRecord, ReviewRating} from '@shared/db/types';

/**
 * Event-driven engagement derivation (REQ-11 / ADR-4, SETE-89).
 *
 * Streak, XP, badges and pet state are all computed from the local
 * `gamification_events` log — the single source of truth — never from wall
 * clock time or transient UI counters. The derivation is pure and deterministic
 * so that force-quitting and relaunching reproduces exactly the same state
 * (VC-6) and so that gamification can never reward the wrong behaviour
 * (RISK mitigation: no XP/streak credit without a completed-review event).
 *
 * Day boundaries: a review session marks the *local* calendar day it was
 * completed on (a streak is a habit, local to the learner). On-time
 * determination compares against the card's due instant, which the scheduler
 * stores in UTC — a review is on time when it happens on or before the UTC day
 * the card was due.
 */

/** XP a completed session earns per rated card (SETE-89 product rule). */
export const XP_PER_RATING: Record<ReviewRating, number> = {
  remembered: 7,
  forgot: 2,
};

/** Water a timely card review pours on the virtual plant. */
export const ON_TIME_WATER_POINTS = 1;

/** Counts of each rating inside one finished review session. */
export type ReviewSessionCounts = {
  remembered: number;
  forgot: number;
};

const EMPTY_COUNTS: ReviewSessionCounts = {remembered: 0, forgot: 0};

/** XP for a whole session = sum of per-rating XP over its rated cards. */
export function sessionXp(counts: Partial<ReviewSessionCounts>): number {
  const merged = {...EMPTY_COUNTS, ...counts};
  return (
    merged.remembered * XP_PER_RATING.remembered +
    merged.forgot * XP_PER_RATING.forgot
  );
}

function endOfUtcDayMs(isoDate: string): number {
  const date = new Date(isoDate);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999,
  );
}

/**
 * True when a card was reviewed on or before the day it was due. The scheduler
 * computes due times in UTC (whole UTC days from the review moment), so the
 * "due day" is the UTC day of `dueAt`; a review is on time when it lands before
 * that day ends. A card with no known due time is never counted as on time.
 */
export function isOnTimeReview({
  dueAt,
  reviewedAt,
}: {
  dueAt: string | null;
  reviewedAt: string;
}): boolean {
  if (!dueAt) {
    return false;
  }
  return Date.parse(reviewedAt) <= endOfUtcDayMs(dueAt);
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/** Local calendar-day key (`YYYY-MM-DD`) for a timestamp. */
export function toLocalDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

/** Adds `delta` local calendar days to a `YYYY-MM-DD` key. */
export function addLocalDays(key: string, delta: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + delta, 12, 0, 0, 0);
  return toLocalDayKey(date);
}

function isNextLocalDay(previous: string, next: string): boolean {
  return addLocalDays(previous, 1) === next;
}

/**
 * Local calendar days that contain at least one completed review session.
 * A "completed review" means the learner finished a review session that rated
 * at least one card — the only event type that feeds streaks.
 */
export function completedReviewSessionDays(
  events: GamificationEventRecord[],
): string[] {
  const days = new Set<string>();
  for (const event of events) {
    if (event.eventType !== 'review_session_completed') {
      continue;
    }
    days.add(toLocalDayKey(new Date(event.createdAt)));
  }
  return [...days].sort();
}

/**
 * Current streak in days. A day is a streak day when it contains a completed
 * review session. The streak is still "alive" when the most recent completed
 * day is today or yesterday (the learner simply has not reviewed yet today);
 * any older gap resets it to 0. Best streak is tracked separately.
 */
export function computeCurrentStreak(
  dayKeys: readonly string[],
  today = new Date(),
): number {
  const days = new Set(dayKeys);
  const todayKey = toLocalDayKey(today);
  let anchor = todayKey;
  if (!days.has(anchor)) {
    const yesterdayKey = addLocalDays(anchor, -1);
    if (!days.has(yesterdayKey)) {
      return 0;
    }
    anchor = yesterdayKey;
  }

  let streak = 0;
  let cursor = anchor;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

/** Longest consecutive run of completed review days, even if now broken. */
export function computeBestStreak(dayKeys: readonly string[]): number {
  if (dayKeys.length === 0) {
    return 0;
  }
  let longest = 1;
  let current = 1;
  for (let index = 1; index < dayKeys.length; index += 1) {
    current = isNextLocalDay(dayKeys[index - 1], dayKeys[index])
      ? current + 1
      : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

export type PetStageId = 'seed' | 'sprout' | 'sapling' | 'tree' | 'bloom';

export type PetStage = {
  id: PetStageId;
  /** Water units required to reach this stage (monotonic milestones). */
  minWater: number;
};

/**
 * Virtual plant growth milestones (SETE-89 product rule, MochiMochi-style).
 * Display labels for each stage live in `src/i18n (gamification.pet_stage / gamification.badge_label / gamification.badge_description)` —
 * this policy only owns the IDs and thresholds.
 */
export const PET_STAGES: readonly PetStage[] = [
  {id: 'seed', minWater: 0},
  {id: 'sprout', minWater: 5},
  {id: 'sapling', minWater: 15},
  {id: 'tree', minWater: 30},
  {id: 'bloom', minWater: 60},
];

export type PetState = {
  stageId: PetStageId;
  waterUnits: number;
  /** Water needed for the next stage, or null at the final stage. */
  waterForNextStage: number | null;
  /** 0..1 progress toward the next stage (1 at the final stage). */
  progressToNextStage: number;
};

/** Derives the plant state purely from accrued on-time water units. */
export function derivePetState(waterUnits: number): PetState {
  let stage = PET_STAGES[PET_STAGES.length - 1];
  let nextStage: PetStage | null = null;
  for (let index = 0; index < PET_STAGES.length; index += 1) {
    const candidate = PET_STAGES[index];
    if (waterUnits >= candidate.minWater) {
      stage = candidate;
      nextStage = PET_STAGES[index + 1] ?? null;
    }
  }
  if (nextStage === null) {
    return {
      stageId: stage.id,
      waterUnits,
      waterForNextStage: null,
      progressToNextStage: 1,
    };
  }
  const span = nextStage.minWater - stage.minWater;
  const progress = (waterUnits - stage.minWater) / span;
  return {
    stageId: stage.id,
    waterUnits,
    waterForNextStage: nextStage.minWater - waterUnits,
    progressToNextStage: Math.min(1, Math.max(0, progress)),
  };
}

export type BadgeId =
  | 'first_review'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'xp_100'
  | 'xp_500'
  | 'water_10'
  | 'water_50';

export type BadgeDefinition = {
  id: BadgeId;
  earned: (counters: {
    totalSessions: number;
    bestStreak: number;
    totalXp: number;
    waterUnits: number;
  }) => boolean;
};

/**
 * Badges rewarded purely from committed review events (SETE-89 product rule).
 * Display labels/descriptions live in `src/i18n (gamification.pet_stage / gamification.badge_label / gamification.badge_description)` —
 * this policy only owns the IDs and earn conditions.
 */
export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {id: 'first_review', earned: counters => counters.totalSessions >= 1},
  {id: 'streak_3', earned: counters => counters.bestStreak >= 3},
  {id: 'streak_7', earned: counters => counters.bestStreak >= 7},
  {id: 'streak_30', earned: counters => counters.bestStreak >= 30},
  {id: 'xp_100', earned: counters => counters.totalXp >= 100},
  {id: 'xp_500', earned: counters => counters.totalXp >= 500},
  {id: 'water_10', earned: counters => counters.waterUnits >= 10},
  {id: 'water_50', earned: counters => counters.waterUnits >= 50},
];

export type EarnedBadge = {
  id: BadgeId;
};

export type GamificationSnapshot = {
  totalSessions: number;
  totalXp: number;
  currentStreak: number;
  bestStreak: number;
  waterUnits: number;
  badges: EarnedBadge[];
  pet: PetState;
};

/**
 * Full state derivation from the event log. Deterministic for the same set of
 * events, so app-start recomputation (and force-quit relaunch reproduction)
 * always agrees with what actually happened.
 */
export function deriveGamificationSnapshot(
  events: readonly GamificationEventRecord[],
  today = new Date(),
): GamificationSnapshot {
  let totalSessions = 0;
  let totalXp = 0;
  let waterUnits = 0;
  for (const event of events) {
    if (event.eventType === 'review_session_completed') {
      totalSessions += 1;
      totalXp += event.points;
    } else if (event.eventType === 'review_on_time') {
      waterUnits += event.points;
    }
  }

  const days = completedReviewSessionDays([...events]);
  const bestStreak = computeBestStreak(days);
  const counters = {totalSessions, bestStreak, totalXp, waterUnits};
  const badges = BADGE_DEFINITIONS.filter(definition =>
    definition.earned(counters),
  ).map(({id}) => ({id}));

  return {
    totalSessions,
    totalXp,
    currentStreak: computeCurrentStreak(days, today),
    bestStreak,
    waterUnits,
    badges,
    pet: derivePetState(waterUnits),
  };
}
