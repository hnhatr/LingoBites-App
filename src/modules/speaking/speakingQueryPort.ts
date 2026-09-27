/**
 * Side-effect-free speaking data/query public port (TASK-012 / Design r2).
 * Cross-feature callers that only need repository reads/writes must use this
 * entry (or the root barrel re-exports below) — not `speakingUiPort`, which
 * pulls native recording permissions.
 */
export {
  captureErrorEvent,
  insertSpeakingRecording,
  listErrorEvents,
  listSpeakingRecordings,
} from './data/SpeakingRepository';
