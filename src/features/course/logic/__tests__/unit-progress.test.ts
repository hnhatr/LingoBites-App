import {
  countUnitProgress,
  readCompletedLessonIds,
  readSummativeState,
  unitProgressRatio,
} from '../unitProgress';

jest.mock('@core/sync/lessonProgress', () => ({
  listCompletedLessons: jest.fn(),
}));
jest.mock('@core/sync/learningOutcomes', () => ({
  getUnitOutcome: jest.fn(),
  listPassedLessonIds: jest.fn(() => new Set()),
}));

const {getUnitOutcome} = jest.requireMock('@core/sync/learningOutcomes') as {
  getUnitOutcome: jest.Mock;
};

const {listCompletedLessons} = jest.requireMock(
  '@core/sync/lessonProgress',
) as {listCompletedLessons: jest.Mock};

describe('unit progress (F14)', () => {
  it('counts only the unit lessons that are completed on device', () => {
    const completed = new Set(['a', 'c', 'other-unit']);

    expect(countUnitProgress(['a', 'b', 'c'], completed)).toEqual({
      completed: 2,
      total: 3,
    });
    expect(countUnitProgress([], completed)).toEqual({completed: 0, total: 0});
  });

  it('turns progress into a clamped bar ratio', () => {
    expect(unitProgressRatio({completed: 1, total: 4})).toBe(0.25);
    expect(unitProgressRatio({completed: 0, total: 0})).toBe(0);
    expect(unitProgressRatio({completed: 5, total: 4})).toBe(1);
  });

  it('reads completed lesson ids from lesson_progress', () => {
    listCompletedLessons.mockReturnValue([
      {lessonId: 'a', completedAt: '2026-10-01T00:00:00.000Z'},
      {lessonId: 'b', completedAt: '2026-10-02T00:00:00.000Z'},
    ]);

    expect([...readCompletedLessonIds()]).toEqual(['a', 'b']);
  });

  it('shows no progress instead of crashing when the local DB fails', () => {
    listCompletedLessons.mockImplementation(() => {
      throw new Error('db closed');
    });

    expect(readCompletedLessonIds().size).toBe(0);
  });

  it('counts passed lessons when they are known (PR 16)', () => {
    expect(
      countUnitProgress(['a', 'b', 'c'], new Set(['a', 'b']), new Set(['a'])),
    ).toEqual({completed: 2, total: 3, passed: 1});
  });

  it('opens the summative task by the Server row or local practice (B4)', () => {
    getUnitOutcome.mockReturnValue(null);
    expect(readSummativeState('u', ['a', 'b'], new Set(['a']))).toBe('locked');
    expect(readSummativeState('u', ['a', 'b'], new Set(['a', 'b']))).toBe(
      'open',
    );
    expect(readSummativeState('u', [], new Set())).toBe('locked');
    getUnitOutcome.mockReturnValue({
      unitId: 'u',
      summativeUnlockedAt: 'x',
      passedAt: null,
    });
    expect(readSummativeState('u', ['a'], new Set())).toBe('open');
    getUnitOutcome.mockReturnValue({
      unitId: 'u',
      summativeUnlockedAt: 'x',
      passedAt: 'y',
    });
    expect(readSummativeState('u', ['a'], new Set())).toBe('passed');
  });
});
