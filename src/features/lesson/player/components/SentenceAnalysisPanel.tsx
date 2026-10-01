import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

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
};

function panelStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    heading: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.bold,
    },
    itemName: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.bold,
    },
    itemBody: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
    },
    hint: {color: theme.colors.text.muted, fontSize: theme.typography.size.sm},
    retry: {color: theme.colors.primary, fontSize: theme.typography.size.sm},
  });
}

/**
 * Sentence analysis panel (FR-008..FR-011, AC-004/005/006).
 *
 * Display-only: analyses fetched after the download are never merged into
 * the stored snapshot (AD-005). Offline with no stored analysis shows the
 * offline message; a busy/failed fetch shows retry. A stored `ready`
 * analysis renders vocabulary and grammar items.
 */
export function SentenceAnalysisPanel({
  sentenceId,
  state,
  onRetry,
}: SentenceAnalysisPanelProps) {
  const {theme} = useAppTheme();
  const styles = panelStyles(theme);
  if (state.status === 'loading') {
    return (
      <View testID={`analysis-loading-${sentenceId}`} style={styles.container}>
        <Text style={styles.hint}>Loading analysis…</Text>
      </View>
    );
  }
  if (state.status === 'offline-missing') {
    return (
      <View testID={`analysis-offline-${sentenceId}`} style={styles.container}>
        <Text style={styles.hint}>
          Analysis is unavailable offline. Connect to load it.
        </Text>
      </View>
    );
  }
  if (state.status === 'busy') {
    return (
      <View testID={`analysis-busy-${sentenceId}`} style={styles.container}>
        <Text style={styles.hint}>
          Analysis is being generated. Try again shortly.
        </Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            testID={`analysis-retry-${sentenceId}`}
            onPress={onRetry}
          >
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (state.status === 'failed') {
    return (
      <View testID={`analysis-error-${sentenceId}`} style={styles.container}>
        <Text style={styles.hint}>{state.message}</Text>
        {state.retryable && onRetry ? (
          <Pressable
            accessibilityRole="button"
            testID={`analysis-retry-${sentenceId}`}
            onPress={onRetry}
          >
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View testID={`analysis-ready-${sentenceId}`} style={styles.container}>
      <Text style={styles.heading}>Analysis</Text>
      {state.analysis.vocabulary.map(item => (
        <View key={item.id} testID={`analysis-vocab-${item.id}`}>
          <Text style={styles.itemName}>
            {item.word} · {item.pos} · {item.ipa}
          </Text>
          <Text style={styles.itemBody}>{item.meaning}</Text>
        </View>
      ))}
      {state.analysis.grammar.map(item => (
        <View key={item.id} testID={`analysis-grammar-${item.id}`}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemBody}>
            {item.description} · {item.formula}
          </Text>
          <Text style={styles.itemBody}>{item.analysis}</Text>
        </View>
      ))}
    </View>
  );
}
