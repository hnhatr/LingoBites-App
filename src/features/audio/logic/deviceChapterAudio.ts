import * as RNFS from '@dr.pogodin/react-native-fs';
import Sound from 'react-native-sound';

import {sha256HexBytes} from '@core/utils/sha256';

import {fetchChapterAudioManifest} from './audioManifestClient';
import {bytesToBase64} from './bytesToBase64';
import type {
  ChapterAudioDownloader,
  ChapterAudioFileStore,
  EnsureChapterAudioResult,
} from './chapterAudioCache';
import {ensureChapterAudio} from './chapterAudioCache';
import {getReadyAudioAsset} from './data/AudioAssetRepository';

/**
 * Real on-device file/download/playback for downloaded chapter audio
 * (REQ-9 / VC-4 / SETE-90).
 *
 * Stage 2 shipped the cache logic with injected ports; this module supplies the
 * device implementations of those ports plus the offline playback service:
 *
 *  - `deviceChapterAudioDownloader` fetches each manifest asset, hashes the
 *    bytes with the same SHA-256 the server manifest declares, and hands the
 *    raw bytes to the file store (so a checksum mismatch never touches disk);
 *  - `deviceChapterAudioFileStore` persists those bytes under the app
 *    Documents directory (`.../LingoBitesAudio/<chapter>/<asset><ext>`) via
 *    the native file system and removes them on eviction;
 *  - `playReadyChapterAudio` resolves the cached file of a ready asset and
 *    plays it with the native audio player — no network involved — so a
 *    downloaded chapter plays in airplane mode.
 *
 * Every function degrades to an explicit error code instead of throwing when a
 * native module is unavailable, keeping the review flow safe on simulators that
 * lack the linked module.
 */

/**
 * True when the native file system module is present. Native bindings are only
 * guaranteed after `pod install` / a Gradle build that links the module, so the
 * device store/downloader degrade instead of throwing when they are missing.
 */
function nativeFsAvailable(): boolean {
  return (
    typeof RNFS.DocumentDirectoryPath === 'string' &&
    RNFS.DocumentDirectoryPath.length > 0
  );
}

function audioRoot(): string {
  return `${RNFS.DocumentDirectoryPath}/LingoBitesAudio`;
}

/** Keeps a chapter/asset id safe to use as a file system segment. */
export function sanitizeFileSegment(segment: string): string {
  const cleaned = segment
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'asset';
}

/** Preserves the audio container from the server URL when it is guessable. */
export function fileExtensionFromUrl(url: string): string {
  const match = /\.([A-Za-z0-9]{1,5})(?:$|[?#])/.exec(url);
  return match ? `.${match[1].toLowerCase()}` : '.mp3';
}

async function ensureDirectory(directory: string): Promise<void> {
  try {
    await RNFS.mkdir(directory);
  } catch {
    // The directory usually already exists on repeat downloads; the write that
    // follows reports a real storage error if creation truly failed.
  }
}

/** Writes downloaded audio bytes under the app's Documents directory. */
export const deviceChapterAudioFileStore: ChapterAudioFileStore = {
  async writeAsset({chapterId, asset, data}) {
    if (!nativeFsAvailable()) {
      throw new Error('UNAVAILABLE');
    }
    const bytes = data as Uint8Array;
    const directory = `${audioRoot()}/${sanitizeFileSegment(chapterId)}`;
    await ensureDirectory(directory);
    const filePath = `${directory}/${sanitizeFileSegment(
      asset.id,
    )}${fileExtensionFromUrl(asset.url)}`;
    try {
      await RNFS.writeFile(filePath, bytesToBase64(bytes), 'base64');
    } catch {
      throw new Error('STORAGE_ERROR');
    }
    return filePath;
  },

  async removeAsset(localPath) {
    if (!nativeFsAvailable()) {
      return;
    }
    try {
      await RNFS.unlink(localPath);
    } catch {
      // Best-effort cleanup: a missing file is already the desired state.
    }
  },
};

/** Fetches a manifest asset and returns checksum-verifiable bytes. */
export const deviceChapterAudioDownloader: ChapterAudioDownloader = {
  async download({asset}) {
    if (!nativeFsAvailable()) {
      throw new Error('UNAVAILABLE');
    }
    let response: Response;
    try {
      response = await fetch(asset.url, {method: 'GET'});
    } catch {
      throw new Error('FETCH_FAILED');
    }
    if (!response.ok) {
      throw new Error(`HTTP_ERROR:${response.status}`);
    }
    let bytes: Uint8Array;
    try {
      const buffer = await response.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } catch {
      throw new Error('FETCH_FAILED');
    }
    return {
      data: bytes,
      bytes: bytes.byteLength,
      checksum: sha256HexBytes(bytes),
    };
  },
};

/** Real-device `ensureChapterAudio` with the native downloader + file store. */
export function ensureChapterAudioOnDevice(
  chapterId: string,
): Promise<EnsureChapterAudioResult> {
  return ensureChapterAudio(chapterId, {
    fetchManifest: fetchChapterAudioManifest,
    downloader: deviceChapterAudioDownloader,
    fileStore: deviceChapterAudioFileStore,
  });
}

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

/** A ready asset id's cached file path, or null when it is missing on disk. */
export async function readyAudioPathOnDevice(
  assetId: string,
): Promise<string | null> {
  const record = getReadyAudioAsset(assetId);
  if (!record?.localPath) {
    return null;
  }
  try {
    const present = await RNFS.exists(record.localPath);
    return present ? record.localPath : null;
  } catch {
    return null;
  }
}
