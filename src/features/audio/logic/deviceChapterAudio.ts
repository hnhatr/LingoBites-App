import Sound from 'react-native-sound';

import {getReadyAudioAsset} from './data/AudioAssetRepository';

/**
 * Offline chapter-audio playback (REQ-9 / VC-4 / SETE-90).
 *
 * The download chain (deviceChapterAudioDownloader, deviceChapterAudioFileStore,
 * ensureChapterAudioOnDevice) has been retired (LING-249). This module now owns
 * only the offline player that resolves a cached file and plays it via the
 * native audio player — no network involved — so a downloaded chapter plays in
 * airplane mode.
 *
 * Every function degrades to an explicit error code instead of throwing when a
 * native module is unavailable, keeping the review flow safe on simulators that
 * lack the linked module.
 */

export type ChapterAudioPlaybackResult =
  | {ok: true}
  | {
      ok: false;
      errorCode: 'NOT_READY' | 'UNAVAILABLE';
      message: string;
    };

let activeSound: Sound | null = null;
let audioSessionConfigured = false;

/** Stops and releases any currently playing clip. */
export function stopChapterAudioPlayback(): void {
  if (activeSound) {
    activeSound.stop();
    activeSound.release();
    activeSound = null;
  }
}

/**
 * Plays a fully downloaded asset from its cached file (offline). Resolves once
 * playback has actually started; `NOT_READY` means the asset has not finished
 * downloading, `UNAVAILABLE` means the native player could not load the file.
 */
export function playReadyChapterAudio(
  assetId: string,
): Promise<ChapterAudioPlaybackResult> {
  return new Promise(resolve => {
    if (!audioSessionConfigured) {
      audioSessionConfigured = true;
      try {
        Sound.setCategory('Playback', true);
        Sound.setActive(true);
      } catch {
        // Non-iOS runtimes ignore the AVAudioSession category.
      }
    }

    const record = getReadyAudioAsset(assetId);
    if (!record?.localPath) {
      resolve({
        ok: false,
        errorCode: 'NOT_READY',
        message: 'Âm thanh chưa được tải về máy.',
      });
      return;
    }

    stopChapterAudioPlayback();
    let sound: Sound;
    try {
      sound = new Sound(record.localPath, '', error => {
        if (error) {
          resolve({
            ok: false,
            errorCode: 'UNAVAILABLE',
            message: 'Không thể mở tệp âm thanh đã tải về.',
          });
          return;
        }
        activeSound = sound;
        sound.play(() => {
          sound.release();
          if (activeSound === sound) {
            activeSound = null;
          }
        });
        resolve({ok: true});
      });
    } catch {
      resolve({
        ok: false,
        errorCode: 'UNAVAILABLE',
        message: 'Trình phát âm thanh chưa sẵn sàng trên thiết bị này.',
      });
    }
  });
}
