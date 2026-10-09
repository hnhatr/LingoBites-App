import {insertGamificationEvent} from '../data/GamificationRepository';
import {
  recordLessonActivityCompleted,
  recordLessonCompletedActivity,
  recordShadowingSessionActivity,
} from '../studyActivity';

jest.mock('../data/GamificationRepository', () => ({
  insertGamificationEvent: jest.fn(),
}));

const insertMock = insertGamificationEvent as jest.Mock;

describe('studyActivity', () => {
  beforeEach(() => {
    insertMock.mockReset();
  });

  it('records a zero-point lesson_completed event', () => {
    expect(
      recordLessonCompletedActivity('lesson-1', '2026-09-05T10:00:00.000Z'),
    ).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({
      eventType: 'lesson_completed',
      sourceEventId: 'lesson-1',
      points: 0,
      createdAt: '2026-09-05T10:00:00.000Z',
    });
  });

  it('records a zero-point shadowing_session_completed event', () => {
    expect(
      recordShadowingSessionActivity('lesson-2', '2026-09-05T10:00:00.000Z'),
    ).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({
      eventType: 'shadowing_session_completed',
      sourceEventId: 'lesson-2',
      points: 0,
      createdAt: '2026-09-05T10:00:00.000Z',
    });
  });

  it('records a zero-point lesson_activity_completed event per attempt', () => {
    expect(
      recordLessonActivityCompleted('attempt-1', '2026-10-08T10:00:00.000Z'),
    ).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({
      eventType: 'lesson_activity_completed',
      sourceEventId: 'attempt-1',
      points: 0,
      createdAt: '2026-10-08T10:00:00.000Z',
    });
  });

  it('never throws when the write fails', () => {
    insertMock.mockImplementation(() => {
      throw new Error('db down');
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(recordLessonCompletedActivity('lesson-1')).toBe(false);
    expect(recordShadowingSessionActivity('lesson-1')).toBe(false);
    expect(recordLessonActivityCompleted('attempt-1')).toBe(false);
    log.mockRestore();
  });
});
