import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppTabs} from '@ui/components/AppTabs';
import {AppText} from '@ui/components/AppText';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {vocabularyItemKey} from '@core/learning';
import type {LessonAnalysis} from '@core/schemas/lesson';

import type {
  GrammarSaveControl,
  VocabularySaveControl,
} from '../logic/useLessonSavedItems';
import {useWordListMatches} from '../logic/wordListMatches';
import {
  BookmarkToggle,
  PillTabs,
  SpeakSquare,
  studyCardStyle,
} from './StudyControls';
import {WordPathBadge} from './WordPathBadge';

type AnalysisTab = 'vocabulary' | 'grammar';

export type SentenceAnalysisTabsProps = {
  sentenceId: string;
  analysis: LessonAnalysis;
  /** Speaks a vocabulary word (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Lưu thẻ" per analysed word; omitted = no save buttons. */
  vocabularySave?: VocabularySaveControl;
  /** "Đánh dấu" per grammar point; omitted = no bookmark buttons. */
  grammarSave?: GrammarSaveControl;
  /** The saved id of a grammar point (the lesson-level one); default its id. */
  grammarKeyOf?: (item: {id: string; name: string}) => string;
  /** Vocab path P6 (F8): the learner's own lesson shows word-list levels and "Thêm vào lộ trình". */
  wordPath?: boolean;
};

/**
 * A sentence's ready analysis in "Học từng câu": vocabulary and grammar in
 * two tabs of a floating bar, each row with its listen and save buttons.
 * (The YouTube sheet keeps the stacked `SentenceAnalysisPanel`.)
 */
export function SentenceAnalysisTabs({
  sentenceId,
  analysis,
  onSpeakText,
  vocabularySave,
  grammarSave,
  grammarKeyOf = item => item.id,
  wordPath = false,
}: SentenceAnalysisTabsProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [tab, setTab] = useState<AnalysisTab>('vocabulary');
  const {vocabulary, grammar} = analysis;
  const wordMatches = useWordListMatches(vocabulary, wordPath);
  const shown: AnalysisTab =
    vocabulary.length === 0
      ? 'grammar'
      : grammar.length === 0
        ? 'vocabulary'
        : tab;
  return (
    <View testID={`analysis-ready-${sentenceId}`} style={styles.ready}>
      {vocabulary.length > 0 && grammar.length > 0 ? (
        <AppTabs
          accessibilityHint={t('lessonPlayer.study_tab_hint')}
          onChange={setTab}
          tabs={[
            {
              id: 'vocabulary',
              label: t('lessonPlayer.analysis_vocabulary'),
              icon: 'style',
              count: vocabulary.length,
            },
            {
              id: 'grammar',
              label: t('lessonPlayer.analysis_grammar'),
              icon: 'rule',
              count: grammar.length,
            },
          ]}
          testID={`analysis-tabs-${sentenceId}`}
          value={shown}
        />
      ) : null}
      <View style={themedStyles.card}>
        {shown === 'vocabulary'
          ? vocabulary.map((item, index) => (
              <View
                key={item.id}
                style={[styles.row, index > 0 ? themedStyles.divider : null]}
                testID={`analysis-vocab-${item.id}`}
              >
                <View style={styles.rowText}>
                  <View style={styles.wordLine}>
                    <AppText style={themedStyles.word}>{item.word}</AppText>
                    {item.ipa ? (
                      <AppText color="muted" variant="caption">
                        {formatIpa(item.ipa)}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText color="secondary" variant="caption">
                    {item.pos ? `${item.meaning} · ${item.pos}` : item.meaning}
                  </AppText>
                  {wordMatches.has(item.id) ? (
                    <WordPathBadge
                      matches={wordMatches.get(item.id)!}
                      testID={`analysis-word-path-${item.id}`}
                    />
                  ) : null}
                </View>
                {onSpeakText ? (
                  <SpeakSquare
                    accessibilityHint={t('lessonPlayer.speak_word_hint')}
                    accessibilityLabel={t('lessonPlayer.speak_word', {
                      word: item.word,
                    })}
                    onPress={() => onSpeakText(item.word)}
                    testID={`analysis-speak-${item.id}`}
                  />
                ) : null}
                {vocabularySave ? (
                  <BookmarkToggle
                    accessibilityHint={t('lessonPlayer.save_card_hint')}
                    label={t('lessonPlayer.save_card')}
                    onPress={() => vocabularySave.onToggle(item)}
                    saved={vocabularySave.isSaved(
                      vocabularyItemKey(item.word) ?? '',
                    )}
                    savedLabel={t('lessonPlayer.saved')}
                    testID={`analysis-save-${item.id}`}
                  />
                ) : null}
              </View>
            ))
          : grammar.map((item, index) => {
              const key = grammarKeyOf(item);
              return (
                <View
                  key={item.id}
                  style={[
                    styles.grammar,
                    index > 0 ? themedStyles.divider : null,
                  ]}
                  testID={`analysis-grammar-${item.id}`}
                >
                  <View style={styles.grammarTop}>
                    <AppText style={[themedStyles.word, styles.flex]}>
                      {item.name}
                    </AppText>
                    {grammarSave ? (
                      <BookmarkToggle
                        accessibilityHint={t(
                          'lessonPlayer.bookmark_grammar_hint',
                        )}
                        label={t('lessonPlayer.bookmark_grammar')}
                        onPress={() => grammarSave.onToggle(key)}
                        saved={grammarSave.isSaved(key)}
                        savedLabel={t('lessonPlayer.saved')}
                        testID={`analysis-grammar-save-${item.id}`}
                      />
                    ) : null}
                  </View>
                  {item.formula ? (
                    <AppText style={themedStyles.formula}>
                      {item.formula}
                    </AppText>
                  ) : null}
                  <AppText color="secondary">{item.description}</AppText>
                  {item.analysis ? (
                    <AppText color="secondary">{item.analysis}</AppText>
                  ) : null}
                </View>
              );
            })}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      ...studyCardStyle(theme),
      overflow: 'hidden',
    },
    divider: {
      borderTopColor: theme.colors.surfaceMuted,
      borderTopWidth: 1.5,
    },
    formula: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      color: theme.colors.primary,
      fontWeight: '700',
      overflow: 'hidden',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    word: {
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '800',
    },
  });
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  grammar: {
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  grammarTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  ready: {
    gap: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  wordLine: {
    alignItems: 'baseline',
    columnGap: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
