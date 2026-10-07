import type {GamificationEventType} from '@core/db/types';

import {listGamificationEvents} from './data/GamificationRepository';
import {toLocalDayKey} from './gamificationPolicy';

/** A finished study session recorded on one local day. */
export type StudyEvent = {
  eventType: GamificationEventType;
  /** Lesson id for lesson/shadowing/practice events, session id for reviews. */
  sourceEventId: string;
  createdAt: string;
};

/**
 * Study sessions finished on the local day of `day`, oldest first. Home uses
 * them to tick off today's plan. Per-card `review_on_time` rows are left out:
 * only whole sessions count as a done step. Never throws; a failed read
 * returns no events.
 */
export function listStudyEventsOn(day = new Date()): StudyEvent[] {
  const dayKey = toLocalDayKey(day);
  try {
    return listGamificationEvents()
      .filter(
        event =>
          !event.tombstone &&
          event.eventType !== 'review_on_time' &&
          toLocalDayKey(new Date(event.createdAt)) === dayKey,
      )
      .map(({eventType, sourceEventId, createdAt}) => ({
        eventType,
        sourceEventId,
        createdAt,
      }));
  } catch (error) {
    console.log('[todayStudyEvents] list failed', error);
    return [];
  }
}
