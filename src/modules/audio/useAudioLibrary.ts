import {
  getAudioCacheStats,
  listReadyAudioAssets,
} from './data/AudioAssetRepository';

/**
 * Public entry point for downloaded-audio reads. Screens call this instead
 * of importing `shared/db/AudioAssetRepository` directly (SETE-118 Việc 3) —
 * the repository stays synchronous under the hood, this only relocates
 * which layer is allowed to know about it.
 *
 * Each member forwards to the repository by name at call time (not captured
 * once into an object) so `jest.spyOn(AudioAssetRepository, ...)` in
 * existing tests keeps working through this indirection.
 */
export function useAudioLibrary() {
  return audioLibrary;
}

const audioLibrary = {
  getAudioCacheStats: (...args: Parameters<typeof getAudioCacheStats>) =>
    getAudioCacheStats(...args),
  listReadyAudioAssets: (...args: Parameters<typeof listReadyAudioAssets>) =>
    listReadyAudioAssets(...args),
};
