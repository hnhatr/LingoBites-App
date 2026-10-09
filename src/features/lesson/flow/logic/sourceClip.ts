import type {ListenAndRepeatContent} from '@core/schemas/activityContent';

/**
 * S4.3: step 2 of a lesson composed from a video replays each sentence's own
 * clip. A prompt has a clip only when it carries both times and the lesson
 * has a video; otherwise the prompt is read with TTS as before.
 */
export type SourceClip = {videoId: string; startMs: number; endMs: number};

/** The player reports its time every 250 ms; stop a little early. */
export const CLIP_STOP_EARLY_MS = 150;

export function sourceClipOf(
  prompt: ListenAndRepeatContent['prompts'][number],
  videoId: string | null | undefined,
): SourceClip | null {
  if (!videoId || prompt.startMs === undefined || prompt.endMs === undefined) {
    return null;
  }
  return {videoId, startMs: prompt.startMs, endMs: prompt.endMs};
}

/** True once playback has reached the end of the clip. */
export function clipReachedEnd(timeMs: number, clip: SourceClip): boolean {
  return timeMs >= clip.endMs - CLIP_STOP_EARLY_MS;
}
