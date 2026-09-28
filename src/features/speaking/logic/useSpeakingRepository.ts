import {insertSpeakingRecording} from './data/SpeakingRepository';

/**
 * Public entry point for speaking-recording persistence. Screens call this
 * instead of importing `shared/db/SpeakingRepository` directly (SETE-118
 * Việc 3) — the repository stays synchronous under the hood, this only
 * relocates which layer is allowed to know about it.
 *
 * Forwards to the repository by name at call time (not captured once into
 * an object) so `jest.spyOn(SpeakingRepository, ...)` in existing tests
 * keeps working through this indirection.
 */
export function useSpeakingRepository() {
  return speakingRepository;
}

const speakingRepository = {
  insertSpeakingRecording: (
    ...args: Parameters<typeof insertSpeakingRecording>
  ) => insertSpeakingRecording(...args),
};
