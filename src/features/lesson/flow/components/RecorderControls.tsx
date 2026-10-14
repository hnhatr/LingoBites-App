import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import {
  type SelfCheckRecorder,
  useSelfCheckRecorder,
} from '../logic/useSelfCheckRecorder';

/**
 * Record yourself and play it back (PR 10 G4). The take stays on the device
 * and is deleted when these controls go away; without a recorder they say
 * so and the learner carries on. Redesign: one large round mic button, with
 * "Nghe lại" next to it once there is a take.
 */
export function RecorderControls({
  recorder: owned,
}: {
  /** PR 14: a recorder the parent keeps (a step-5 answer sent for grading). */
  recorder?: SelfCheckRecorder;
} = {}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const own = useSelfCheckRecorder(owned ? null : undefined);
  const recorder = owned ?? own;

  if (recorder.state === 'unavailable') {
    return (
      <AppText color="secondary" testID="lesson-flow-recorder-unavailable">
        {t('lessonFlow.recorder_unavailable')}
      </AppText>
    );
  }
  const recording = recorder.state === 'recording';
  const recorded = recorder.state === 'recorded';
  const title = recording
    ? t('lessonFlow.stop_recording')
    : recorded
      ? t('lessonFlow.record_again')
      : t('lessonFlow.record');
  return (
    <View style={themedStyles.container}>
      <View style={themedStyles.row}>
        <View style={themedStyles.side} />
        <View style={[themedStyles.halo, recording && themedStyles.haloLive]}>
          <Pressable
            accessibilityHint={
              recording
                ? t('lessonFlow.stop_recording_hint')
                : t('lessonFlow.record_hint')
            }
            accessibilityLabel={title}
            accessibilityRole="button"
            onPress={recording ? recorder.stop : recorder.start}
            style={({pressed}) => [
              themedStyles.mic,
              recording && themedStyles.micLive,
              pressed && themedStyles.pressed,
            ]}
            testID={
              recording ? 'lesson-flow-stop-recording' : 'lesson-flow-record'
            }
          >
            <MaterialIcon
              color={
                recording ? theme.colors.text.inverse : theme.colors.accentInk
              }
              name={recording ? 'pause' : 'mic'}
              size={38}
            />
          </Pressable>
        </View>
        <View style={themedStyles.side}>
          {recorded ? (
            <IconButton
              accessibilityHint={t('lessonFlow.play_recording_hint')}
              accessibilityLabel={t('lessonFlow.play_recording')}
              icon="play_arrow"
              onPress={recorder.play}
              size={52}
              testID="lesson-flow-play-recording"
              tone="ghost"
            />
          ) : null}
        </View>
      </View>
      <AppText
        color={recording ? 'primary' : 'secondary'}
        style={themedStyles.caption}
        variant="label"
      >
        {recording ? t('lessonFlow.recording_now') : title}
      </AppText>
    </View>
  );
}

const MIC_SIZE = 84;
const HALO_SIZE = 112;

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    caption: {
      textAlign: 'center',
    },
    container: {
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
    },
    halo: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: HALO_SIZE / 2,
      height: HALO_SIZE,
      justifyContent: 'center',
      width: HALO_SIZE,
    },
    haloLive: {
      backgroundColor: colors.secondarySoft,
    },
    mic: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: MIC_SIZE / 2,
      height: MIC_SIZE,
      justifyContent: 'center',
      width: MIC_SIZE,
      ...getStickerFace(theme, 5),
    },
    micLive: {
      backgroundColor: colors.secondaryContainer,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    side: {
      alignItems: 'center',
      width: 56,
    },
  });
}
