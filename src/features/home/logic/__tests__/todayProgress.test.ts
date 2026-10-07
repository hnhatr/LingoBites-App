import type {StudyEvent} from '@features/engagement';
import type {StudyActivityItem, StudyBlockPlan} from '@features/today';

import {
  buildTodayProgress,
  isLessonStep,
  localDayKey,
  reusableTodayPlan,
} from '../todayProgress';

function step(
  id: string,
  type: StudyActivityItem['type'],
  estimatedMinutes: number,
  targetId?: string,
): StudyActivityItem {
  return {
    id,
    type,
    titleVi: id,
    subtitleVi: '',
    estimatedMinutes,
    targetId,
    navigationTarget: {screen: 'DailyReview'},
  };
}

function plan(activities: StudyActivityItem[]): StudyBlockPlan {
  return {
    mode: 'normal',
    isConsolidation: false,
    totalEstimatedMinutes: activities.reduce(
      (sum, item) => sum + item.estimatedMinutes,
      0,
    ),
    reasonCodes: [],
    explanationVi: '',
    activities,
  };
}

function event(
  eventType: StudyEvent['eventType'],
  sourceEventId = 'x',
): StudyEvent {
  return {eventType, sourceEventId, createdAt: '2026-10-07T09:00:00.000Z'};
}

const REVIEW = step('review', 'due_review', 5, 'due_review');
const LESSON = step('lesson', 'next_lesson', 8, 'lesson-1');
const SPEAK = step('speak', 'speaking_practice', 7, 'speaking_room');
const RECALL = step('recall', 'active_recall', 4);

describe('buildTodayProgress', () => {
  it('starts with nothing done and the first step next', () => {
    const model = buildTodayProgress(plan([REVIEW, LESSON, SPEAK]), []);
    expect(model.doneIds.size).toBe(0);
    expect(model.doneMinutes).toBe(0);
    expect(model.totalMinutes).toBe(20);
    expect(model.nextActivity?.id).toBe('review');
    expect(model.allDone).toBe(false);
  });

  it('ticks a review step from a finished review session', () => {
    const model = buildTodayProgress(plan([REVIEW, LESSON, SPEAK]), [
      event('review_session_completed'),
    ]);
    expect([...model.doneIds]).toEqual(['review']);
    expect(model.doneMinutes).toBe(5);
    expect(model.nextActivity?.id).toBe('lesson');
  });

  it('ticks a lesson step only for that lesson', () => {
    const other = buildTodayProgress(plan([LESSON]), [
      event('lesson_completed', 'lesson-2'),
    ]);
    expect(other.doneIds.size).toBe(0);
    const same = buildTodayProgress(plan([LESSON]), [
      event('lesson_completed', 'lesson-1'),
    ]);
    expect(same.allDone).toBe(true);
  });

  it('uses each event for one step only', () => {
    const second = step('review-2', 'error_remediation', 3, 'x');
    const model = buildTodayProgress(plan([REVIEW, second]), [
      event('review_session_completed'),
    ]);
    expect([...model.doneIds]).toEqual(['review']);
    expect(model.nextActivity?.id).toBe('review-2');
  });

  it('ticks speaking and practice steps from their sessions', () => {
    const model = buildTodayProgress(plan([SPEAK, RECALL]), [
      event('practice_session_completed'),
      event('shadowing_session_completed'),
    ]);
    expect(model.allDone).toBe(true);
    expect(model.nextActivity).toBeNull();
    expect(model.doneMinutes).toBe(model.totalMinutes);
  });

  it('shows at most three steps and counts the rest', () => {
    const model = buildTodayProgress(plan([REVIEW, LESSON, SPEAK, RECALL]), []);
    expect(model.steps.map(item => item.id)).toEqual([
      'review',
      'lesson',
      'speak',
    ]);
    expect(model.hiddenStepCount).toBe(1);
  });

  it('is never all done for an empty plan', () => {
    expect(buildTodayProgress(plan([]), []).allDone).toBe(false);
  });
});

describe('isLessonStep', () => {
  it('is true only for steps that finish a lesson', () => {
    expect(isLessonStep(LESSON)).toBe(true);
    expect(isLessonStep(step('pre', 'prerequisite_lesson', 5, 'l'))).toBe(true);
    expect(isLessonStep(REVIEW)).toBe(false);
    expect(isLessonStep(null)).toBe(false);
  });
});

describe('reusableTodayPlan', () => {
  const stored = {
    dayKey: '2026-10-07',
    mode: 'normal' as const,
    plan: plan([REVIEW]),
  };

  it('reuses the plan for the same day and mode', () => {
    expect(reusableTodayPlan(stored, '2026-10-07', 'normal')).toBe(stored.plan);
  });

  it('drops it on a new day, another mode or when empty', () => {
    expect(reusableTodayPlan(stored, '2026-10-08', 'normal')).toBeNull();
    expect(reusableTodayPlan(stored, '2026-10-07', '5-minute')).toBeNull();
    expect(
      reusableTodayPlan({...stored, plan: plan([])}, '2026-10-07', 'normal'),
    ).toBeNull();
    expect(reusableTodayPlan(null, '2026-10-07', 'normal')).toBeNull();
  });
});

describe('localDayKey', () => {
  it('formats the local calendar day', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
