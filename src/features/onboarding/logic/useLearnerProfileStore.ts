import {create} from 'zustand';

import {setLearnerAgeGroup} from '@core/learning';

import {
  readCachedProfile,
  sanitizeProfile,
  writeCachedProfile,
} from './learnerProfileCache';
import {
  fetchLearnerProfile,
  putLearnerProfile,
  type ServerLearnerProfile,
} from './learnerProfileClient';
import type {LearnerProfileInput} from './profileOptions';

/**
 * Phase 2 (P2.4): whether the signed-in learner still needs onboarding, and
 * their profile once they do not.
 *
 * - `checking`: first start on this device, waiting for the Server.
 * - `needed`: no profile anywhere (or the Server could not be reached and
 *   nothing is cached): the onboarding screens are shown. They work offline.
 * - `ready`: a profile exists (possibly only on the device, `pending`).
 */
export type LearnerProfileStatus = 'idle' | 'checking' | 'needed' | 'ready';

type State = {
  status: LearnerProfileStatus;
  userId: string | null;
  profile: LearnerProfileInput | null;
  /** Answers not saved on the Server yet. */
  pending: boolean;
  load: (userId: string) => Promise<void>;
  /**
   * Saves the profile here at once, then on the Server. `finish` ends
   * onboarding; without it (before the placement test) the gate stays.
   */
  save: (
    profile: LearnerProfileInput,
    options?: {finish?: boolean},
  ) => Promise<void>;
  reset: () => void;
};

function fromServer(profile: ServerLearnerProfile): LearnerProfileInput | null {
  return sanitizeProfile({
    ageGroup: profile.age_group,
    levelCode: profile.level_code,
    goals: profile.goals,
    interests: profile.interests,
    dailyMinutes: profile.daily_minutes,
  });
}

export const useLearnerProfileStore = create<State>()((set, get) => {
  async function push(userId: string, profile: LearnerProfileInput) {
    const result = await putLearnerProfile(profile);
    if (!result.ok || get().userId !== userId) return;
    writeCachedProfile({userId, profile, pending: false});
    if (get().profile === profile) set({pending: false});
  }

  return {
    status: 'idle',
    userId: null,
    profile: null,
    pending: false,

    load: async userId => {
      const cached = readCachedProfile(userId);
      if (cached) {
        set({
          status: 'ready',
          userId,
          profile: cached.profile,
          pending: cached.pending,
        });
        if (cached.pending) await push(userId, cached.profile);
        return;
      }
      set({status: 'checking', userId, profile: null, pending: false});
      const result = await fetchLearnerProfile();
      if (get().userId !== userId) return;
      const profile =
        result.ok && result.value ? fromServer(result.value) : null;
      if (profile) {
        writeCachedProfile({userId, profile, pending: false});
        set({status: 'ready', profile, pending: false});
      } else {
        set({status: 'needed'});
      }
    },

    save: async (profile, options = {}) => {
      const {userId, status} = get();
      if (!userId) return;
      writeCachedProfile({userId, profile, pending: true});
      set({
        profile,
        pending: true,
        status: options.finish || status === 'ready' ? 'ready' : status,
      });
      await push(userId, profile);
    },

    reset: () =>
      set({status: 'idle', userId: null, profile: null, pending: false}),
  };
});

// The curriculum screens read the age group from `@core/learning`.
useLearnerProfileStore.subscribe(state =>
  setLearnerAgeGroup(state.profile?.ageGroup ?? null),
);
