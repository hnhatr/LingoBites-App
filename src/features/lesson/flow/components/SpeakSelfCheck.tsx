import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryResult} from '../logic/activityOutcome';
import type {HintStep} from '../logic/hints';
import {HintLadder} from './HintLadder';
import {SLOW_TTS_RATE} from './ListenCardDeck';
import {RecorderControls} from './RecorderControls';

export type SpeakSelfCheckProps = {
  /** The model sentence (spoken with TTS, shown when revealed). */
  model: string;
  /** Redesign: the model's Vietnamese, shown under it (listen and repeat). */
  meaning?: string;
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
 * learner still judges; only the record buttons go away. Redesign: the model
 * on a card with normal and slow playback, a large mic; the result shows in
 * the player's bottom sheet (EntrySequence).
 */
export function SpeakSelfCheck({
  model,
  meaning,
  hints,
  onReport,
}: SpeakSelfCheckProps) {
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
        <View style={themedStyles.model}>
          <View style={themedStyles.listenRow}>
            <IconButton
              accessibilityHint={t('lessonFlow.listen_model_hint')}
              accessibilityLabel={t('lessonFlow.listen_model')}
              icon="volume_up"
              onPress={() => {
                speak(model).catch(() => undefined);
              }}
              size={52}
              testID="lesson-flow-listen-model"
              tone="accent"
            />
            <IconButton
              accessibilityHint={t('lessonFlow.listen_slow_hint')}
              accessibilityLabel={t('lessonFlow.listen_slow')}
              icon="timer"
              onPress={() => {
                speak(model, undefined, SLOW_TTS_RATE).catch(() => undefined);
              }}
              size={52}
              testID="lesson-flow-listen-model-slow"
              tone="ghost"
            />
            <View style={themedStyles.wave}>
              {WAVE.map((_, position) => (
                <View
                  key={position}
                  style={[themedStyles.bar, waveStyles[position]]}
                />
              ))}
            </View>
          </View>
          <AppText testID="lesson-flow-model-sentence" variant="h1">
            {model}
          </AppText>
          {meaning ? (
            <AppText
              color="secondary"
              testID="lesson-flow-prompt"
              variant="bodyLg"
            >
              {meaning}
            </AppText>
          ) : null}
        </View>
      ) : (
        <HintLadder
          disabled={judged !== null}
          onSupportChange={setSupport}
          steps={hints}
        />
      )}
      <RecorderControls />
      {judged === null ? (
        <View style={themedStyles.judge}>
          <AppText
            color="secondary"
            style={themedStyles.center}
            variant="label"
          >
            {t('lessonFlow.self_check_question')}
          </AppText>
          <View style={themedStyles.row}>
            <AppButton
              accessibilityHint={t('lessonFlow.self_pass_hint')}
              iconLeft="check_circle"
              onPress={() => judge('first_try')}
              style={themedStyles.flex}
              testID="lesson-flow-self-pass"
              title={t('lessonFlow.self_pass')}
            />
            <AppButton
              accessibilityHint={t('lessonFlow.self_fail_hint')}
              onPress={() => judge('not_yet')}
              style={themedStyles.flex}
              testID="lesson-flow-self-fail"
              title={t('lessonFlow.self_fail')}
              variant="outline"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Heights of the decorative waveform bars. */
const WAVE = [10, 22, 30, 16, 26, 34, 20, 12, 24, 30, 18, 26, 14, 8];
const waveStyles = WAVE.map(height => StyleSheet.create({bar: {height}}).bar);

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.accent,
      borderRadius: 2,
      width: 4,
    },
    center: {
      textAlign: 'center',
    },
    container: {
      gap: theme.spacing.md,
    },
    flex: {
      flex: 1,
    },
    judge: {
      gap: theme.spacing.sm,
    },
    listenRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    model: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      ...getStickerFace(theme, 5),
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    wave: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 3,
      height: 36,
      overflow: 'hidden',
    },
  });
}
