import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {EntryResult} from '../logic/activityOutcome';
import {useSelfCheckRecorder} from '../logic/useSelfCheckRecorder';

export type SpeakSelfCheckProps = {
  /** The model sentence (spoken with TTS, shown when revealed). */
  model: string;
  /** Show the model text from the start; otherwise "Xem câu mẫu" shows it. */
  modelVisible: boolean;
  onReport: (result: EntryResult) => void;
};

/**
 * Speaking in Stage 2: hear the model, record yourself and listen back, then
 * judge it "Đạt" or "Chưa đạt" (decision G4). Without a microphone the
 * learner still judges; only the record buttons go away.
 */
export function SpeakSelfCheck({
  model,
  modelVisible,
  onReport,
}: SpeakSelfCheckProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const recorder = useSelfCheckRecorder();
  const [revealed, setRevealed] = useState(modelVisible);
  const [judged, setJudged] = useState<EntryResult | null>(null);

  const judge = (result: EntryResult) => {
    if (judged) return;
    setJudged(result);
    onReport(result);
  };

  return (
    <View style={themedStyles.container}>
      {revealed ? (
        <AppText testID="lesson-flow-model-sentence" variant="bodyLg">
          {model}
        </AppText>
      ) : null}
      <View style={themedStyles.row}>
        <AppButton
          accessibilityHint={t('lessonFlow.listen_model_hint')}
          iconLeft="volume_up"
          onPress={() => {
            speak(model).catch(() => undefined);
          }}
          testID="lesson-flow-listen-model"
          title={t('lessonFlow.listen_model')}
          variant="secondary"
        />
        {revealed ? null : (
          <AppButton
            accessibilityHint={t('lessonFlow.show_model_hint')}
            onPress={() => setRevealed(true)}
            testID="lesson-flow-show-model"
            title={t('lessonFlow.show_model')}
            variant="ghost"
          />
        )}
      </View>
      {recorder.state === 'unavailable' ? (
        <AppText color="secondary" testID="lesson-flow-recorder-unavailable">
          {t('lessonFlow.recorder_unavailable')}
        </AppText>
      ) : (
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
      )}
      <AppText color="secondary" variant="label">
        {t('lessonFlow.self_check_question')}
      </AppText>
      <View style={themedStyles.row}>
        <AppButton
          accessibilityHint={t('lessonFlow.self_pass_hint')}
          disabled={judged !== null}
          onPress={() => judge('first_try')}
          style={themedStyles.flex}
          testID="lesson-flow-self-pass"
          title={t('lessonFlow.self_pass')}
        />
        <AppButton
          accessibilityHint={t('lessonFlow.self_fail_hint')}
          disabled={judged !== null}
          onPress={() => judge('not_yet')}
          style={themedStyles.flex}
          testID="lesson-flow-self-fail"
          title={t('lessonFlow.self_fail')}
          variant="outline"
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
