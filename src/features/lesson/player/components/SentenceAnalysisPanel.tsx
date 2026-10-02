import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis} from '@core/schemas/lesson';

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
            <View
              key={item.id}
              testID={`analysis-vocab-${item.id}`}
              style={themedStyles.vocabRow}
            >
              <View style={styles.flex1}>
                <AppText variant="bodyLg">
                  {item.word}
                  <AppText color="muted"> · {item.pos}</AppText>
                </AppText>
                <AppText color="muted" variant="caption">
                  /{item.ipa.replace(/^\/|\/$/g, '')}/
                </AppText>
                <AppText color="secondary">{item.meaning}</AppText>
              </View>
              {onSpeakText ? (
                <IconButton
                  accessibilityLabel={t('lessonPlayer.speak_word', {
                    word: item.word,
                  })}
                  accessibilityHint={t('lessonPlayer.speak_word_hint')}
                  icon="volume_up"
                  onPress={() => onSpeakText(item.word)}
                  testID={`analysis-speak-${item.id}`}
                  tone="ghost"
                />
              ) : null}
            </View>
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
    vocabRow: {
      alignItems: 'center',
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
  });
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    gap: 2,
  },
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
