export const YOUTUBE_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25] as const;

export type YouTubePlaybackRate = (typeof YOUTUBE_PLAYBACK_RATES)[number];

export function nextYouTubePlaybackRate(
  current: YouTubePlaybackRate,
): YouTubePlaybackRate {
  const index = YOUTUBE_PLAYBACK_RATES.indexOf(current);
  if (index === -1) {
    return 1;
  }
  const next = (index + 1) % YOUTUBE_PLAYBACK_RATES.length;
  return YOUTUBE_PLAYBACK_RATES[next];
}

export function formatYouTubePlaybackRate(rate: YouTubePlaybackRate): string {
  return rate === 1 ? '1×' : `${rate}×`;
}
