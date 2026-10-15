import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {
  type SelfCheckRecorder,
  useSelfCheckRecorder,
} from '../logic/useSelfCheckRecorder';
import {SoftButton} from './SoftButton';

/**
 * Record yourself and play it back (PR 10 G4). The take stays on the device
 * and is deleted when these controls go away; without a recorder they say
 * so and the learner carries on. A large coral mic; once there is a take it
 * gives way to "Nghe lại" and "Ghi lại".
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
  if (recorder.state === 'recorded') {
    return (
      <View style={themedStyles.takeRow}>
        <SoftButton
          accessibilityHint={t('lessonFlow.play_recording_hint')}
          icon="play_arrow"
          label={t('lessonFlow.play_recording')}
          onPress={recorder.play}
          testID="lesson-flow-play-recording"
        />
        <SoftButton
          accessibilityHint={t('lessonFlow.record_hint')}
          icon="mic"
          label={t('lessonFlow.record_again')}
          onPress={recorder.start}
          testID="lesson-flow-record"
        />
      </View>
    );
  }
  const title = recording
    ? t('lessonFlow.stop_recording')
    : t('lessonFlow.record');
  return (
    <View style={themedStyles.container}>
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
          {recording ? (
            <View style={themedStyles.stop} />
          ) : (
            <MaterialIcon color={HERO_PALETTE.white} name="mic" size={36} />
          )}
        </Pressable>
      </View>
      <AppText color="secondary" style={themedStyles.caption} variant="label">
        {recording ? t('lessonFlow.recording_now') : t('lessonFlow.record_tap')}
      </AppText>
    </View>
  );
}

const MIC_SIZE = 84;
const HALO_SIZE = 104;

function makeStyles(theme: AppTheme) {
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
      backgroundColor: HERO_PALETTE.coralRing,
      borderRadius: HALO_SIZE / 2,
      height: HALO_SIZE,
      justifyContent: 'center',
      width: HALO_SIZE,
    },
    haloLive: {
      backgroundColor: withAlpha(HERO_PALETTE.coral, 0.4),
    },
    mic: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.coral,
      borderRadius: MIC_SIZE / 2,
      height: MIC_SIZE,
      justifyContent: 'center',
      width: MIC_SIZE,
      ...getStickerEdge(5, HERO_PALETTE.coralShelf),
    },
    micLive: {
      backgroundColor: HERO_PALETTE.coralShelf,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    stop: {
      backgroundColor: HERO_PALETTE.white,
      borderRadius: 6,
      height: 24,
      width: 24,
    },
    takeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      justifyContent: 'center',
      paddingVertical: theme.spacing.sm,
    },
  });
}
