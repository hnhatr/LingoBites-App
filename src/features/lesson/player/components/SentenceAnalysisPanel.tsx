import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {WordCard} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {vocabularyItemKey} from '@core/learning';
import type {LessonAnalysis} from '@core/schemas/lesson';

import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {SaveItemButton} from './SaveItemButton';

export type SentenceAnalysisPanelState =
  | {status: 'loading'}
  | {status: 'ready'; analysis: LessonAnalysis}
  | {status: 'offline-missing'}
  | {status: 'busy'};
export type SentenceAnalysisPanelError = {
  status: 'failed';
  retryable: boolean;
  message: string;
};

export type SentenceAnalysisPanelProps = {
  sentenceId: string;
  state: SentenceAnalysisPanelState | SentenceAnalysisPanelError;
  onRetry?: () => void;
  /** Speaks a vocabulary word (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Lưu thẻ" per analysed word; omitted = no save buttons. */
  vocabularySave?: VocabularySaveControl;
};

/**
 * Per-sentence analysis under the selected sentence: vocabulary and grammar
 * when ready, otherwise the loading / offline / busy / failed notice with a
 * retry where the state allows one.
 */
export function SentenceAnalysisPanel({
  sentenceId,
  state,
  onRetry,
  onSpeakText,
  vocabularySave,
}: SentenceAnalysisPanelProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);

  const retryButton = onRetry ? (
    <AppButton
      accessibilityHint={t('lessonPlayer.retry_hint')}
      onPress={onRetry}
      testID={`analysis-retry-${sentenceId}`}
      title={t('common.retry')}
      variant="secondary"
    />
  ) : null;

  if (state.status === 'loading') {
    return (
      <View
        testID={`analysis-loading-${sentenceId}`}
        style={themedStyles.notice}
      >
        <AppText color="secondary">
          {t('lessonPlayer.analysis_loading')}
        </AppText>
      </View>
    );
  }
  if (state.status === 'offline-missing') {
    return (
      <View
        testID={`analysis-offline-${sentenceId}`}
        style={themedStyles.notice}
      >
        <AppText color="secondary">
          {t('lessonPlayer.analysis_offline')}
        </AppText>
      </View>
    );
  }
  if (state.status === 'busy') {
    return (
      <View testID={`analysis-busy-${sentenceId}`} style={themedStyles.notice}>
        <AppText color="secondary">{t('lessonPlayer.analysis_busy')}</AppText>
        {retryButton}
      </View>
    );
  }
  if (state.status === 'failed') {
    return (
      <View testID={`analysis-error-${sentenceId}`} style={themedStyles.notice}>
        <AppText color="danger">{state.message}</AppText>
        {state.retryable ? retryButton : null}
      </View>
    );
  }
  const {vocabulary, grammar} = state.analysis;
  return (
    <View testID={`analysis-ready-${sentenceId}`} style={themedStyles.panel}>
      <View style={styles.titleRow}>
        <MaterialIcon
          color={theme.colors.primary}
          name="auto_awesome"
          size={20}
        />
        <AppText style={themedStyles.heading} variant="h3">
          {t('lessonPlayer.analysis_title')}
        </AppText>
      </View>
      {vocabulary.length > 0 ? (
        <View style={styles.group}>
          <AppText color="muted" style={styles.groupLabel} variant="label">
            {t('lessonPlayer.analysis_vocabulary')}
          </AppText>
          {vocabulary.map(item => (
            <WordCard
              key={item.id}
              actions={
                vocabularySave ? (
                  <SaveItemButton
                    accessibilityHint={t('lessonPlayer.save_card_hint')}
                    label={t('lessonPlayer.save_card')}
                    onPress={() => vocabularySave.onToggle(item)}
                    saved={vocabularySave.isSaved(
                      vocabularyItemKey(item.word) ?? '',
                    )}
                    savedLabel={t('lessonPlayer.saved')}
                    testID={`analysis-save-${item.id}`}
                  />
                ) : undefined
              }
              ipa={item.ipa}
              meaning={item.meaning}
              onSpeak={onSpeakText ? () => onSpeakText(item.word) : undefined}
              pos={item.pos}
              speakAccessibilityHint={t('lessonPlayer.speak_word_hint')}
              speakAccessibilityLabel={t('lessonPlayer.speak_word', {
                word: item.word,
              })}
              speakTestID={`analysis-speak-${item.id}`}
              testID={`analysis-vocab-${item.id}`}
              variant="inline"
              word={item.word}
            />
          ))}
        </View>
      ) : null}
      {grammar.length > 0 ? (
        <View style={styles.group}>
          <AppText color="muted" style={styles.groupLabel} variant="label">
            {t('lessonPlayer.analysis_grammar')}
          </AppText>
          {grammar.map(item => (
            <View
              key={item.id}
              testID={`analysis-grammar-${item.id}`}
              style={themedStyles.grammarPod}
            >
              <AppText variant="label">{item.name}</AppText>
              <AppText style={themedStyles.formula}>{item.formula}</AppText>
              <AppText color="secondary">{item.description}</AppText>
              <AppText color="secondary">{item.analysis}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    formula: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.medium,
      overflow: 'hidden',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    grammarPod: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    heading: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.medium,
    },
    notice: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    panel: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.accentSoft,
      borderBottomWidth: 4,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
  });
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  groupLabel: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
