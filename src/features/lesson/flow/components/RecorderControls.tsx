import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  type SelfCheckRecorder,
  useSelfCheckRecorder,
} from '../logic/useSelfCheckRecorder';

/**
 * Record yourself and play it back (PR 10 G4). The take stays on the device
 * and is deleted when these controls go away; without a recorder they say
 * so and the learner carries on.
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
  return (
    <View style={themedStyles.row}>
      {recorder.state === 'recording' ? (
        <AppButton
          accessibilityHint={t('lessonFlow.stop_recording_hint')}
          onPress={recorder.stop}
          testID="lesson-flow-stop-recording"
          title={t('lessonFlow.stop_recording')}
          variant="secondary-coral"
        />
      ) : (
        <AppButton
          accessibilityHint={t('lessonFlow.record_hint')}
          iconLeft="mic"
          onPress={recorder.start}
          testID="lesson-flow-record"
          title={
            recorder.state === 'recorded'
              ? t('lessonFlow.record_again')
              : t('lessonFlow.record')
          }
          variant="outline"
        />
      )}
      {recorder.state === 'recorded' ? (
        <AppButton
          accessibilityHint={t('lessonFlow.play_recording_hint')}
          onPress={recorder.play}
          testID="lesson-flow-play-recording"
          title={t('lessonFlow.play_recording')}
          variant="outline"
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
