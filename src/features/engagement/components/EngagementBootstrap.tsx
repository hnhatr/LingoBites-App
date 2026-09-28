import {useEffect} from 'react';
import {useFeatureEnabled} from '@/release';
import {bootstrapGoldenHourReminders} from '../logic/nativeReminderScheduler';

/**
 * App-start engagement bootstrap: recomputes reminder state from the local
 * schedule and reconciles OS notifications with it. Runs whenever the review
 * system feature is enabled. Delivers no UI — gamification state is always
 * recomputed from the persisted event log on read (see `getGamificationSnapshot`).
 *
 * Notifications are installed by `bootstrapGoldenHourReminders`: when the OS
 * already granted permission it swaps the no-op scheduler for the real native
 * adapter and reconciles; otherwise the no-op scheduler keeps this path safe.
 */
export function EngagementBootstrap() {
  const reviewSystemEnabled = useFeatureEnabled('reviewSystem');

  useEffect(() => {
    if (!reviewSystemEnabled) {
      return;
    }
    bootstrapGoldenHourReminders().catch(() => {});
  }, [reviewSystemEnabled]);

  return null;
}
