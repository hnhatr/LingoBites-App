import React, {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';

import {
  YouTubePlayer,
  type YouTubePlayerRef,
} from '../../player/components/YouTubePlayer';
import {clipReachedEnd, type SourceClip} from '../logic/sourceClip';

export type SourceClipPlayerProps = {
  clip: SourceClip;
};

/**
 * S4.3: "Nghe đoạn gốc" plays one sentence's clip of the source video and
 * stops at its end. When the video cannot play (offline, removed) the player
 * hides and the TTS model below is all that remains.
 */
export function SourceClipPlayer({clip}: SourceClipPlayerProps) {
  const {t} = useTranslation();
  const playerRef = useRef<YouTubePlayerRef>(null);
  const playingRef = useRef(false);
  const [failed, setFailed] = useState(false);

  const play = useCallback(() => {
    playingRef.current = true;
    playerRef.current?.seekTo(clip.startMs / 1000);
    playerRef.current?.play();
  }, [clip.startMs]);

  const handleTime = useCallback(
    (seconds: number) => {
      if (playingRef.current && clipReachedEnd(seconds * 1000, clip)) {
        playingRef.current = false;
        playerRef.current?.pause();
      }
    },
    [clip],
  );

  if (failed) return null;
  return (
    <View style={styles.wrap} testID="lesson-flow-source-clip">
      <YouTubePlayer
        ref={playerRef}
        onError={() => setFailed(true)}
        onTimeUpdate={handleTime}
        videoId={clip.videoId}
      />
      <AppButton
        accessibilityHint={t('lessonFlow.play_clip_hint')}
        iconLeft="play_arrow"
        onPress={play}
        testID="lesson-flow-play-clip"
        title={t('lessonFlow.play_clip')}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
});
