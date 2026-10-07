import type {GamificationEventRecord} from '@core/db/types';

import {listGamificationEvents} from '../data/GamificationRepository';
import {listStudyEventsOn} from '../todayStudyEvents';

jest.mock('../data/GamificationRepository', () => ({
  listGamificationEvents: jest.fn(),
}));

const listMock = listGamificationEvents as jest.Mock;

function row(
  overrides: Partial<GamificationEventRecord>,
): GamificationEventRecord {
  return {
    id: 'e',
    eventType: 'lesson_completed',
    sourceEventId: 'lesson-1',
    points: 0,
    createdAt: new Date(2026, 9, 7, 9, 0).toISOString(),
    revision: 0,
    tombstone: false,
    ...overrides,
  };
}

describe('listStudyEventsOn', () => {
  beforeEach(() => listMock.mockReset());

  it('keeps finished sessions from the same local day only', () => {
    listMock.mockReturnValue([
      row({id: 'a'}),
      row({
        id: 'b',
        eventType: 'review_session_completed',
        sourceEventId: 'session-1',
      }),
      row({id: 'c', createdAt: new Date(2026, 9, 6, 23, 0).toISOString()}),
      row({id: 'd', eventType: 'review_on_time'}),
      row({id: 'e', tombstone: true}),
    ]);
    const events = listStudyEventsOn(new Date(2026, 9, 7, 20, 0));
    expect(events.map(event => event.eventType)).toEqual([
      'lesson_completed',
      'review_session_completed',
    ]);
    expect(events[0]).toEqual({
      eventType: 'lesson_completed',
      sourceEventId: 'lesson-1',
      createdAt: new Date(2026, 9, 7, 9, 0).toISOString(),
    });
  });

  it('never throws when the read fails', () => {
    listMock.mockImplementation(() => {
      throw new Error('db down');
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(listStudyEventsOn(new Date())).toEqual([]);
    log.mockRestore();
  });
});
