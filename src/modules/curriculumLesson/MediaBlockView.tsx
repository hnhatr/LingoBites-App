import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import {blockBaseStyles} from './blockStyles';
import {
  useCurriculumLessonAudio,
  type CurriculumLessonSoundFactory,
} from './curriculumLessonAudio';
import type {CurriculumLessonMediaAsset} from './curriculumLessonSchema';

type Props = {
  media: CurriculumLessonMediaAsset;
  createSound?: CurriculumLessonSoundFactory;
};

function extraStyles(theme: AppTheme) {
  return StyleSheet.create({
    image: {
      borderRadius: theme.radius.md,
      height: 200,
      width: '100%',
    },
    controlsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    controlButton: {
      flex: 1,
    },
    statusText: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
    },
  });
}

function ImageMedia({media}: {media: CurriculumLessonMediaAsset}) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const extra = extraStyles(theme);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View testID="media-image-fallback" style={styles.fallbackBox}>
        <Text style={styles.fallbackText}>This image could not be loaded.</Text>
        <Text style={styles.caption}>{media.altText}</Text>
      </View>
    );
  }
  return (
    <Image
      testID="media-image"
      accessibilityRole="image"
      accessibilityLabel={media.altText}
      accessibilityHint="Lesson illustration image"
      accessibilityIgnoresInvertColors
      source={{uri: media.url}}
      style={extra.image}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const AUDIO_STATUS_LABELS: Record<string, string> = {
  idle: 'Tap play to listen.',
  loading: 'Loading audio…',
  playing: 'Playing…',
  paused: 'Paused.',
  ended: 'Finished. Tap replay to listen again.',
  error: 'This audio could not be played.',
  unavailable: 'Audio playback is not available on this device.',
};

function AudioMedia({
  media,
  createSound,
}: {
  media: CurriculumLessonMediaAsset;
  createSound?: CurriculumLessonSoundFactory;
}) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const extra = extraStyles(theme);
  const {status, play, pause, replay} = useCurriculumLessonAudio(media.url, {
    createSound,
  });
  const isPlaying = status === 'playing';
  const busy = status === 'loading';
  return (
    <View testID="block-media-audio">
      <View style={extra.controlsRow}>
        <Pressable
          testID="media-audio-play-pause"
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
          accessibilityHint="Plays or pauses the lesson audio"
          accessibilityState={{disabled: busy}}
          disabled={busy}
          onPress={isPlaying ? pause : play}
          style={[
            styles.button,
            extra.controlButton,
            busy ? styles.buttonDisabled : null,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              testID="media-audio-loading"
              color={theme.colors.text.inverse}
            />
          ) : (
            <Text style={styles.buttonText}>
              {isPlaying ? 'Pause' : status === 'paused' ? 'Resume' : 'Play'}
            </Text>
          )}
        </Pressable>
        <Pressable
          testID="media-audio-replay"
          accessibilityRole="button"
          accessibilityLabel="Replay audio"
          accessibilityHint="Restarts the lesson audio from the beginning"
          accessibilityState={{disabled: busy}}
          disabled={busy}
          onPress={replay}
          style={[
            styles.secondaryButton,
            extra.controlButton,
            busy ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Replay</Text>
        </Pressable>
      </View>
      <Text testID="media-audio-status" style={extra.statusText}>
        {AUDIO_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

/**
 * Renders a `media` block. Image failures and audio failures stay local to
 * this renderer: an image shows a fallback box, audio shows a status line,
 * and neither blocks navigation.
 */
export function MediaBlockView({media, createSound}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  return (
    <View testID="block-media">
      {media.type === 'image' ? (
        <ImageMedia media={media} />
      ) : (
        <AudioMedia media={media} createSound={createSound} />
      )}
      {media.caption ? (
        <Text testID="block-media-caption" style={styles.caption}>
          {media.caption}
        </Text>
      ) : null}
    </View>
  );
}
