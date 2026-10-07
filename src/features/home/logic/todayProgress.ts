/**
 * todayProgress — pure "what is done today" logic for the Home plan card.
 *
 * Home keeps one study plan per local day (see `TodayPlanRepository`) and
 * ticks its steps off from the finished sessions in the gamification log.
 * No study time is measured: progress minutes are the estimates of the
 * steps that are done.
 *
 * Step ↔ event matching (each event ticks at most one step):
 * - due_review / error_remediation / listening_remediation → a finished
 *   review session (all three open DailyReview)
 * - next_lesson / prerequisite_lesson → `lesson_completed` for that lesson
 * - old_situation_practice → `lesson_completed` or a quick-practice session
 *   for that lesson (a finished lesson records no new completion)
 * - speaking_practice / interview_practice → a finished Shadowing session
 * - active_recall → any quick-practice session
 */
import type {StudyEvent} from '@features/engagement';
import type {
  StudyActivityItem,
  StudyActivityType,
  StudyBlockPlan,
  TodayMode,
} from '@features/today';

/** Steps the Home checklist shows; the rest stay on the Today screen. */
export const TODAY_VISIBLE_STEPS = 3;

/** Plan types that finish a lesson and so move the weekly goal. */
const LESSON_STEP_TYPES: ReadonlySet<StudyActivityType> = new Set([
  'next_lesson',
  'prerequisite_lesson',
]);

type EventMatcher = (event: StudyEvent, step: StudyActivityItem) => boolean;

const isReview: EventMatcher = event =>
  event.eventType === 'review_session_completed';
const isSameLessonDone: EventMatcher = (event, step) =>
  event.eventType === 'lesson_completed' &&
  step.targetId != null &&
  event.sourceEventId === step.targetId;
const isShadowing: EventMatcher = event =>
  event.eventType === 'shadowing_session_completed';
const isPractice: EventMatcher = event =>
  event.eventType === 'practice_session_completed';

const MATCHERS: Record<StudyActivityType, EventMatcher> = {
  due_review: isReview,
  error_remediation: isReview,
  listening_remediation: isReview,
  next_lesson: isSameLessonDone,
  prerequisite_lesson: isSameLessonDone,
  old_situation_practice: (event, step) =>
    isSameLessonDone(event, step) ||
    (isPractice(event, step) && event.sourceEventId === step.targetId),
  speaking_practice: isShadowing,
  interview_practice: isShadowing,
  active_recall: isPractice,
};

export type TodayProgressModel = {
  mode: TodayMode;
  /** Steps shown on Home, in plan order. */
  steps: StudyActivityItem[];
  /** Plan steps beyond the visible ones. */
  hiddenStepCount: number;
  /** Ids of every plan step that is done today. */
  doneIds: ReadonlySet<string>;
  doneMinutes: number;
  totalMinutes: number;
  /** First step that is not done yet, or null when the plan is finished. */
  nextActivity: StudyActivityItem | null;
  /** True when the plan has steps and all of them are done. */
  allDone: boolean;
};

export function isLessonStep(activity: StudyActivityItem | null): boolean {
  return activity != null && LESSON_STEP_TYPES.has(activity.type);
}

/** Ticks off plan steps from today's events; pure and order-preserving. */
export function buildTodayProgress(
  plan: StudyBlockPlan,
  events: readonly StudyEvent[],
): TodayProgressModel {
  const unused = [...events];
  const doneIds = new Set<string>();
  for (const step of plan.activities) {
    const matches = MATCHERS[step.type];
    const index = unused.findIndex(event => matches(event, step));
    if (index >= 0) {
      unused.splice(index, 1);
      doneIds.add(step.id);
    }
  }

  const totalMinutes = plan.activities.reduce(
    (sum, step) => sum + step.estimatedMinutes,
    0,
  );
  const doneMinutes = plan.activities
    .filter(step => doneIds.has(step.id))
    .reduce((sum, step) => sum + step.estimatedMinutes, 0);
  const nextActivity =
    plan.activities.find(step => !doneIds.has(step.id)) ?? null;

  return {
    mode: plan.mode,
    steps: plan.activities.slice(0, TODAY_VISIBLE_STEPS),
    hiddenStepCount: Math.max(0, plan.activities.length - TODAY_VISIBLE_STEPS),
    doneIds,
    doneMinutes,
    totalMinutes,
    nextActivity,
    allDone: plan.activities.length > 0 && nextActivity === null,
  };
}

/** Local calendar day as `YYYY-MM-DD`, the key a stored plan belongs to. */
export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type StoredPlanLike = {
  dayKey: string;
  mode: TodayMode;
  plan: StudyBlockPlan;
};

/**
 * The stored plan when it still fits: same day, same mode and not empty (an
 * empty plan from before the first download must not stick all day).
 */
export function reusableTodayPlan(
  stored: StoredPlanLike | null,
  dayKey: string,
  mode: TodayMode,
): StudyBlockPlan | null {
  if (
    stored == null ||
    stored.dayKey !== dayKey ||
    stored.mode !== mode ||
    stored.plan.activities.length === 0
  ) {
    return null;
  }
  return stored.plan;
}
