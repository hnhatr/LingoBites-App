import type {CanonicalLessonViewState} from './useCanonicalLesson';

/**
 * The lesson is not on the device and the network request failed: the
 * learner needs a connection to download it (offline-mode.md #11).
 */
export function isLessonNotDownloaded(
  state: CanonicalLessonViewState,
): boolean {
  return (
    state.status === 'error' &&
    'kind' in state.error &&
    state.error.kind === 'network-error'
  );
}
