import {useCallback, useEffect, useRef, useState} from 'react';
import type Sound from 'react-native-sound';

/**
 * Injectable audio port for curriculum lesson media blocks.
 *
 * The player never touches a concrete audio implementation directly: tests
 * inject a fake `CurriculumLessonSoundFactory`, while production uses
 * {@link defaultCurriculumLessonSoundFactory} (react-native-sound, loaded
 * defensively so an unlinked build degrades to `unavailable` instead of
 * crashing). This mirrors the lazy native-module pattern in
 * `src/modules/audio/ttsService.ts`.
 */

export type CurriculumLessonSoundHandle = {
  play(onEnd?: (success: boolean) => void): void;
  pause(): void;
  stop(): void;
  release(): void;
};

export type CurriculumLessonSoundFactory = (
  url: string,
) => CurriculumLessonSoundHandle | null;

type NativeSound = Pick<Sound, 'play' | 'pause' | 'stop' | 'release'>;

type NativeSoundModule = {
  default?: new (
    filename: string,
    basePath?: string,
    onLoad?: (error: unknown) => void,
  ) => NativeSound;
};

let cachedSoundClass:
  | (new (
      filename: string,
      basePath?: string,
      onLoad?: (error: unknown) => void,
    ) => NativeSound)
  | null
  | undefined;

/** Loads react-native-sound defensively; null when the module is missing. */
function getNativeSoundClass(): NativeSoundModule['default'] | null {
  if (cachedSoundClass !== undefined) {
    return cachedSoundClass;
  }
  try {
    const mod = require('react-native-sound') as NativeSoundModule;
    cachedSoundClass =
      mod.default ?? (mod as unknown as NativeSoundModule['default']);
  } catch {
    cachedSoundClass = null;
  }
  return cachedSoundClass;
}

/**
 * Production sound factory. Returns null when the native module is
 * unavailable or construction throws, so the renderer can show its local
 * fallback UI. Load failures surface through `play`'s completion callback.
 */
export function defaultCurriculumLessonSoundFactory(
  url: string,
): CurriculumLessonSoundHandle | null {
  const SoundClass = getNativeSoundClass();
  if (!SoundClass) {
    return null;
  }
  let loadError: unknown = null;
  let sound: NativeSound | null = null;
  try {
    sound = new SoundClass(url, undefined, error => {
      loadError = error;
    });
  } catch {
    return null;
  }
  const instance = sound;
  return {
    play: onEnd => {
      if (loadError || !instance) {
        onEnd?.(false);
        return;
      }
      try {
        instance.play(onEnd);
      } catch {
        onEnd?.(false);
      }
    },
    pause: () => {
      try {
        instance.pause();
      } catch {
        // Pause is best-effort; status stays consistent via the caller.
      }
    },
    stop: () => {
      try {
        instance.stop();
      } catch {
        // Stop is best-effort (replay still restarts from position 0).
      }
    },
    release: () => {
      try {
        instance.release();
      } catch {
        // Release must never throw during unmount cleanup.
      }
    },
  };
}

export type CurriculumLessonAudioStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error'
  | 'unavailable';

export type UseCurriculumLessonAudioOptions = {
  createSound?: CurriculumLessonSoundFactory;
};

export type UseCurriculumLessonAudioResult = {
  status: CurriculumLessonAudioStatus;
  /** Start or resume playback; no-op while loading/playing. */
  play: () => void;
  /** Pause playback; no-op unless playing. */
  pause: () => void;
  /** Restart playback from the beginning. */
  replay: () => void;
};

/**
 * Play/pause/replay state for one media-block audio URL.
 *
 * The native handle is released when the URL changes and on unmount, so no
 * playback resource survives navigation away from the block.
 */
export function useCurriculumLessonAudio(
  url: string,
  options: UseCurriculumLessonAudioOptions = {},
): UseCurriculumLessonAudioResult {
  const {createSound = defaultCurriculumLessonSoundFactory} = options;
  const [status, setStatus] = useState<CurriculumLessonAudioStatus>('idle');
  const soundRef = useRef<CurriculumLessonSoundHandle | null>(null);
  const statusRef = useRef<CurriculumLessonAudioStatus>('idle');
  const factoryRef = useRef(createSound);
  factoryRef.current = createSound;

  const updateStatus = useCallback((next: CurriculumLessonAudioStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    updateStatus('idle');
    return () => {
      soundRef.current?.release();
      soundRef.current = null;
    };
  }, [url, updateStatus]);

  const handleEnded = useCallback(
    (success: boolean) => {
      if (success) {
        updateStatus('ended');
      } else {
        soundRef.current?.release();
        soundRef.current = null;
        updateStatus('error');
      }
    },
    [updateStatus],
  );

  const play = useCallback(() => {
    if (statusRef.current === 'playing' || statusRef.current === 'loading') {
      return;
    }
    const current = soundRef.current;
    if (current) {
      updateStatus('playing');
      current.play(handleEnded);
      return;
    }
    updateStatus('loading');
    let handle: CurriculumLessonSoundHandle | null = null;
    try {
      handle = factoryRef.current(url);
    } catch {
      handle = null;
    }
    if (!handle) {
      updateStatus('unavailable');
      return;
    }
    soundRef.current = handle;
    updateStatus('playing');
    handle.play(handleEnded);
  }, [handleEnded, updateStatus, url]);

  const pause = useCallback(() => {
    if (!soundRef.current || statusRef.current !== 'playing') {
      return;
    }
    soundRef.current.pause();
    updateStatus('paused');
  }, [updateStatus]);

  const replay = useCallback(() => {
    if (statusRef.current === 'loading') {
      return;
    }
    const current = soundRef.current;
    if (current) {
      current.stop();
      updateStatus('playing');
      current.play(handleEnded);
      return;
    }
    play();
  }, [handleEnded, play, updateStatus]);

  return {status, play, pause, replay};
}
