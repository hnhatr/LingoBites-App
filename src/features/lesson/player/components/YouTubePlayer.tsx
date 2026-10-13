import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';
import YoutubeIframe, {
  PLAYER_ERRORS,
  type YoutubeIframeRef,
} from 'react-native-youtube-iframe';

const TIME_UPDATE_INTERVAL_MS = 250;
const PLAYER_MIN_HEIGHT = 200;
// Pause this close to the end so the player never reaches YouTube's
// 'ended' state, which shows a grid of suggested videos.
const END_GUARD_S = 0.5;

// Quiet the embed: no controls bar, captions, annotations, related videos
// or fullscreen button. The creator's end-screen cards cannot be turned off
// from the IFrame API; the frame takes no touches so they cannot be opened.
const INITIAL_PLAYER_PARAMS = {
  controls: false,
  showClosedCaptions: false,
  iv_load_policy: 3,
  modestbranding: true,
  preventFullScreen: true,
  rel: false,
} as const;

export const YOUTUBE_PLAYER_ERROR_CODES = {
  INVALID_PARAMETER: 'YOUTUBE_INVALID_URL',
  HTML5_ERROR: 'YOUTUBE_PLAYER_HTML5_ERROR',
  VIDEO_NOT_FOUND: 'YOUTUBE_VIDEO_NOT_FOUND',
  EMBED_NOT_ALLOWED: 'YOUTUBE_NOT_EMBEDDABLE',
} as const;

export type YouTubePlayerErrorCode =
  | (typeof YOUTUBE_PLAYER_ERROR_CODES)[keyof typeof YOUTUBE_PLAYER_ERROR_CODES]
  | 'YOUTUBE_PLAYER_UNKNOWN_ERROR';

export function mapYouTubePlayerError(error: string): YouTubePlayerErrorCode {
  switch (error) {
    case PLAYER_ERRORS.INVALID_PARAMETER:
      return YOUTUBE_PLAYER_ERROR_CODES.INVALID_PARAMETER;
    case PLAYER_ERRORS.HTML5_ERROR:
      return YOUTUBE_PLAYER_ERROR_CODES.HTML5_ERROR;
    case PLAYER_ERRORS.VIDEO_NOT_FOUND:
      return YOUTUBE_PLAYER_ERROR_CODES.VIDEO_NOT_FOUND;
    case PLAYER_ERRORS.EMBED_NOT_ALLOWED:
      return YOUTUBE_PLAYER_ERROR_CODES.EMBED_NOT_ALLOWED;
    default:
      return 'YOUTUBE_PLAYER_UNKNOWN_ERROR';
  }
}

export interface YouTubePlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
}

export interface YouTubePlayerProps {
  videoId: string;
  playbackRate?: number;
  onReady?: () => void;
  onTimeUpdate?: (time: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onAdPlayingChange?: (isAd: boolean) => void;
  onStateChange?: (state: string) => void;
  onEnded?: () => void;
  onError?: (error: YouTubePlayerErrorCode) => void;
}

const INJECTED_A11Y_JS = `
  (function() {
    try {
      var meta = document.querySelector('meta[name="viewport"]');
      if (meta && meta.content) {
        meta.content = meta.content.replace(/user-scalable=no/g, 'user-scalable=yes');
      }
      var style = document.createElement('style');
      style.innerHTML = '* { -webkit-user-select: text !important; user-select: text !important; }';
      document.head.appendChild(style);
    } catch(e) {}
  })();
  (function() {
    // cc_load_policy=0 only stops forcing captions; a video with default
    // captions (or a viewer who enabled them on YouTube) still shows them.
    // Unload the captions module whenever the player (re)loads it.
    function hideCaptions() {
      try {
        player.unloadModule('captions');
        player.setOption('captions', 'track', {});
      } catch(e) {}
    }
    var attempts = 0;
    var timer = setInterval(function() {
      attempts += 1;
      if (attempts > 120) {
        clearInterval(timer);
        return;
      }
      if (typeof player === 'undefined' || !player || !player.addEventListener || !player.unloadModule) {
        return;
      }
      clearInterval(timer);
      hideCaptions();
      player.addEventListener('onApiChange', hideCaptions);
      player.addEventListener('onStateChange', function(event) {
        if (event && event.data === 1) {
          hideCaptions();
        }
      });
    }, 500);
  })();
  true;
`;

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  (
    {
      videoId,
      playbackRate = 1,
      onReady,
      onTimeUpdate,
      onPlayingChange,
      onAdPlayingChange,
      onStateChange,
      onEnded,
      onError,
    },
    ref,
  ) => {
    const {t} = useTranslation();
    const playerRef = useRef<YoutubeIframeRef>(null);
    const [playing, setPlaying] = useState(false);
    const [ready, setReady] = useState(false);
    const durationRef = useRef(0);
    const endGuardHitRef = useRef(false);
    // SETE-328: the frame is exactly 16:9 — measured from the layout width
    // so it holds on every screen size. No overlay is ever placed above the
    // iframe. The WebView itself takes no touches (YouTube's own chrome —
    // share, settings, end-screen cards — would open from them); a tap on
    // the frame toggles play/pause through our state instead, and
    // onPlayingChange keeps every shell button in sync.
    const [frameWidth, setFrameWidth] = useState(0);

    useImperativeHandle(ref, () => ({
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
      },
      getCurrentTime: async () => {
        const time = await playerRef.current?.getCurrentTime();
        return time ?? 0;
      },
      getDuration: async () => {
        const duration = await playerRef.current?.getDuration();
        return duration ?? 0;
      },
    }));

    const handleReady = useCallback(() => {
      setReady(true);
      onReady?.();
    }, [onReady]);

    // SETE-290 (DEV-3): 'ended' marks the lesson completed so the next
    // open starts from the beginning instead of resuming the tail.
    const handleChangeState = useCallback(
      (state: string) => {
        onStateChange?.(state);

        if (state === 'ad' || state === 'ad_playing') {
          onAdPlayingChange?.(true);
          return;
        }

        if (state === 'playing') {
          setPlaying(true);
          onPlayingChange?.(true);
          onAdPlayingChange?.(false);
          return;
        }

        if (state === 'paused' || state === 'ended') {
          setPlaying(false);
          onPlayingChange?.(false);
          onAdPlayingChange?.(false);
        }
        if (state === 'ended') {
          onEnded?.();
        }
      },
      [onAdPlayingChange, onEnded, onPlayingChange, onStateChange],
    );

    const handleError = useCallback(
      (error: string) => {
        onError?.(mapYouTubePlayerError(error));
      },
      [onError],
    );

    useEffect(() => {
      durationRef.current = 0;
      endGuardHitRef.current = false;
    }, [videoId]);

    // Stops just short of the end and reports it as ended, so YouTube's
    // suggested-videos screen never appears.
    const guardEnd = useCallback(
      async (time: number) => {
        if (durationRef.current <= 0) {
          durationRef.current = (await playerRef.current?.getDuration()) ?? 0;
        }
        const duration = durationRef.current;
        if (duration <= END_GUARD_S) {
          return;
        }
        if (time < duration - END_GUARD_S) {
          endGuardHitRef.current = false;
          return;
        }
        if (endGuardHitRef.current) {
          return;
        }
        endGuardHitRef.current = true;
        setPlaying(false);
        onPlayingChange?.(false);
        onEnded?.();
      },
      [onEnded, onPlayingChange],
    );

    useEffect(() => {
      if (!ready) {
        return undefined;
      }

      let cancelled = false;

      const pollCurrentTime = async () => {
        const time = await playerRef.current?.getCurrentTime();
        if (cancelled || time == null) {
          return;
        }
        onTimeUpdate?.(time);
        if (playing) {
          await guardEnd(time);
        }
      };

      pollCurrentTime().catch(() => {});
      const intervalId = setInterval(() => {
        pollCurrentTime().catch(() => {});
      }, TIME_UPDATE_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [ready, onTimeUpdate, videoId, playing, guardEnd]);

    const togglePlaying = useCallback(() => {
      setPlaying(current => !current);
    }, []);

    // Pre-layout fallback keeps a visible frame on the very first commit;
    // the measured width takes over immediately after.
    const frameHeight =
      frameWidth > 0 ? (frameWidth * 9) / 16 : PLAYER_MIN_HEIGHT;

    return (
      <View
        onLayout={event => setFrameWidth(event.nativeEvent.layout.width)}
        style={styles.container}
      >
        <Pressable
          accessibilityHint={t('youtube.video_toggle_hint')}
          accessibilityLabel={
            playing
              ? t('youtube.video_pause_a11y')
              : t('youtube.video_play_a11y')
          }
          accessibilityRole="button"
          onPress={togglePlaying}
          testID="youtube-player-frame"
        >
          <View pointerEvents="none">
            <YoutubeIframe
              ref={playerRef}
              height={frameHeight}
              width={frameWidth > 0 ? frameWidth : undefined}
              play={playing}
              playbackRate={playbackRate}
              initialPlayerParams={INITIAL_PLAYER_PARAMS}
              videoId={videoId}
              onChangeState={handleChangeState}
              onReady={handleReady}
              onError={handleError}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
                injectedJavaScript: INJECTED_A11Y_JS,
              }}
            />
          </View>
        </Pressable>
      </View>
    );
  },
);

YouTubePlayer.displayName = 'YouTubePlayer';

const styles = StyleSheet.create({
  container: {
    aspectRatio: 16 / 9,
    width: '100%',
  },
});
