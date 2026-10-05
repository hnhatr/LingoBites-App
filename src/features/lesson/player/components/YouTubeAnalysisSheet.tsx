import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis} from '@core/schemas/lesson';

import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {
  SentenceAnalysisPanel,
  type SentenceAnalysisPanelError,
  type SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {YouTubeSheet} from './YouTubeSheet';

export type YouTubeAnalysisSheetProps = {
  visible: boolean;
  sentenceId: string;
  analyses: Record<string, LessonAnalysis>;
  lateAnalyses?: Record<string, LessonAnalysis>;
  offline?: boolean;
  analysisStates?: Record<
    string,
    SentenceAnalysisPanelState | SentenceAnalysisPanelError
  >;
  onClose: () => void;
  onRequestAnalysis?: (sentenceId: string) => void;
  onRetryAnalysis?: (sentenceId: string) => void;
  onSpeakText?: (text: string) => void;
  vocabularySave?: VocabularySaveControl;
};

/**
 * Analysis sheet for the current study card — mirrors the selection order in
 * `CanonicalLessonPlayer` (stored → async → offline → analyze CTA).
 */
export function YouTubeAnalysisSheet({
  visible,
  sentenceId,
  analyses,
  lateAnalyses,
  offline,
  analysisStates,
  onClose,
  onRequestAnalysis,
  onRetryAnalysis,
  onSpeakText,
  vocabularySave,
}: YouTubeAnalysisSheetProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const stored = analyses[sentenceId] ?? lateAnalyses?.[sentenceId];
  const asyncState = analysisStates?.[sentenceId];

  let body: React.ReactNode;
  if (stored) {
    body = (
      <SentenceAnalysisPanel
        onSpeakText={onSpeakText}
        sentenceId={sentenceId}
        state={{status: 'ready', analysis: stored}}
        vocabularySave={vocabularySave}
      />
    );
  } else if (asyncState) {
    body = (
      <SentenceAnalysisPanel
        onRetry={
          onRetryAnalysis ? () => onRetryAnalysis(sentenceId) : undefined
        }
        onSpeakText={onSpeakText}
        sentenceId={sentenceId}
        state={asyncState}
      />
    );
  } else if (offline) {
    body = (
      <SentenceAnalysisPanel
        sentenceId={sentenceId}
        state={{status: 'offline-missing'}}
      />
    );
  } else {
    body = (
      <Pressable
        accessibilityHint={t('lessonPlayer.analyze_hint')}
        accessibilityLabel={t('lessonPlayer.analyze')}
        accessibilityRole="button"
        onPress={() => onRequestAnalysis?.(sentenceId)}
        style={({pressed}) => [
          styles.analyzeButton,
          pressed ? styles.pressed : null,
        ]}
        testID={`canonical-analyze-${sentenceId}`}
      >
        <MaterialIcon
          color={theme.colors.primary}
          name="auto_awesome"
          size={18}
        />
        <AppText style={styles.analyzeText} variant="label">
          {t('lessonPlayer.analyze')}
        </AppText>
      </Pressable>
    );
  }

  return (
    <YouTubeSheet
      accessibilityLabel={t('youtube.study.sheet_analysis_a11y')}
      onClose={onClose}
      testID="youtube-sheet-analysis"
      title={t('youtube.study.sheet_analysis_title')}
      visible={visible}
    >
      <View style={styles.content}>{body}</View>
    </YouTubeSheet>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    analyzeButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
    },
    analyzeText: {
      color: theme.colors.primary,
    },
    content: {
      flex: 1,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
  });
}
