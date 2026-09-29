/**
 * Audio playback adapter for the lesson runtime (SETE-108 / M3).
 *
 * `content_audio_assets` (M2) only stores metadata (url/checksum) — actual
 * on-device download/caching for content-package audio is M5 territory, not
 * built yet. This adapter therefore never calls `fetch`: it degrades to a
 * clear "not downloaded yet" result instead, which is what keeps the
 * runtime's offline guarantee true today (no network call after import) and
 * gives the M5 implementation a single place to plug in a real player later.
 */

import type {AudioAsset} from '../schema';

export type ContentAudioPlaybackResult =
  | {ok: true}
  | {ok: false; errorCode: 'NOT_DOWNLOADED'; message: string};

export function playContentAudio(
  assetId: string | null,
  audioAssets: ReadonlyMap<string, AudioAsset>,
): ContentAudioPlaybackResult {
  const asset = assetId ? audioAssets.get(assetId) : undefined;
  if (!asset) {
    return {
      ok: false,
      errorCode: 'NOT_DOWNLOADED',
      message: 'Âm thanh chưa được tải về máy.',
    };
  }
  // TODO(M5): resolve the cached file for `asset` and play it offline, the
  // same way `deviceChapterAudio.playReadyChapterAudio` does for chapters.
  return {
    ok: false,
    errorCode: 'NOT_DOWNLOADED',
    message: 'Âm thanh chưa được tải về máy.',
  };
}
