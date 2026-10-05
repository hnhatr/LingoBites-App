import {useEffect} from 'react';

import {useFeatureEnabled} from '@core/release';

import {applyReminderSettings} from '../logic/reminderSettings';

/**
 * App-start engagement bootstrap: recomputes reminder state from the local
 * schedule and reconciles OS notifications with it. Runs whenever the review
 * system feature is enabled. Delivers no UI — gamification state is always
 * recomputed from the persisted event log on read (see `getGamificationSnapshot`).
 *
 * Notifications are installed by `applyReminderSettings`: it honours the
 * learner's Nhắc nhở switch, and when the OS already granted permission it
 * swaps the no-op scheduler for the real native adapter, reconciles and
 * re-arms the daily reminder; otherwise the no-op scheduler keeps this safe.
 */
export function EngagementBootstrap() {
  const reviewSystemEnabled = useFeatureEnabled('reviewSystem');

  useEffect(() => {
    if (!reviewSystemEnabled) {
      return;
    }
    applyReminderSettings().catch(() => {});
  }, [reviewSystemEnabled]);

  return null;
}
