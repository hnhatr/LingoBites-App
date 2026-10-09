import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryResult} from '../logic/activityOutcome';
import type {HintStep} from '../logic/hints';
import {HintLadder} from './HintLadder';
import {RecorderControls} from './RecorderControls';

export type SpeakSelfCheckProps = {
  /** The model sentence (spoken with TTS, shown when revealed). */
  model: string;
  /**
   * `null`: the model is the content (listen and repeat): its text shows and
   * "Nghe câu mẫu" is free. A ladder: the model only comes through the hints
   * (PR 11 G3), which raise the support level.
   */
  hints: readonly HintStep[] | null;
  onReport: (result: EntryResult, support: LessonSupportLevel) => void;
};

/**
 * Speaking in Stage 2: hear the model, record yourself and listen back, then
 * judge it "Đạt" or "Chưa đạt" (decision G4). Without a microphone the
 * learner still judges; only the record buttons go away.
 */
export function SpeakSelfCheck({model, hints, onReport}: SpeakSelfCheckProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [support, setSupport] = useState<LessonSupportLevel>('none');
  const [judged, setJudged] = useState<EntryResult | null>(null);

  const judge = (result: EntryResult) => {
    if (judged) return;
    setJudged(result);
    onReport(result, support);
  };

  return (
    <View style={themedStyles.container}>
      {hints === null ? (
        <>
          <AppText testID="lesson-flow-model-sentence" variant="bodyLg">
            {model}
          </AppText>
          <AppButton
            accessibilityHint={t('lessonFlow.listen_model_hint')}
            iconLeft="volume_up"
            onPress={() => {
              speak(model).catch(() => undefined);
            }}
            style={themedStyles.start}
            testID="lesson-flow-listen-model"
            title={t('lessonFlow.listen_model')}
            variant="secondary"
          />
        </>
      ) : (
        <HintLadder
          disabled={judged !== null}
          onSupportChange={setSupport}
          steps={hints}
        />
      )}
      <RecorderControls />
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
    start: {
      alignSelf: 'flex-start',
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
