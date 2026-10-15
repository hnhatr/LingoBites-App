/**
 * LessonContentTabs — "Từ & nội dung bài" on the lesson hub: a floating tab
 * bar over one card that lists either the lesson's words and phrases or its
 * sentences. The sentence list has a switch for the Vietnamese under each
 * line instead of separate original / translation / bilingual modes.
 */
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, Switch, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {LibraryCover} from '@ui/components/LibraryCover';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {LessonSentence} from '@core/schemas/lesson';

import type {LessonVocabularyEntry} from '../logic/lessonHubContent';

/** Rows shown before "Xem tất cả" / "Xem cả". */
const WORD_PREVIEW = 5;
const SENTENCE_PREVIEW = 4;

type Tab = 'words' | 'sentences';

type Props = {
  words: LessonVocabularyEntry[];
  /** Item id → picture URL (catalog lessons); words without one get none. */
  itemImages: ReadonlyMap<string, string>;
  /** Shows the word pictures (catalog lessons). */
  showPictures: boolean;
  sentences: LessonSentence[];
  /** Opens the words & phrases section. */
  onOpenWords: () => void;
  /** Speaks a word or sentence; omitted = no listen buttons. */
  onSpeakText?: (text: string) => void;
};

export function LessonContentTabs({
  words,
  itemImages,
  showPictures,
  sentences,
  onOpenWords,
  onSpeakText,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hasWords = words.length > 0;
  const [tab, setTab] = useState<Tab>(hasWords ? 'words' : 'sentences');
  const [showVi, setShowVi] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const shownTab: Tab = hasWords ? tab : 'sentences';
  const visibleSentences = expanded
    ? sentences
    : sentences.slice(0, SENTENCE_PREVIEW);

  if (!hasWords && sentences.length === 0) return null;

  const tabs: {id: Tab; label: string}[] = [
    {id: 'words', label: t('lessonPlayer.tab_words', {count: words.length})},
    {
      id: 'sentences',
      label: t('lessonPlayer.tab_sentences', {count: sentences.length}),
    },
  ];

  return (
    <View style={styles.section} testID="lesson-content">
      <AppText variant="h3">{t('lessonPlayer.content_title')}</AppText>
      {hasWords ? (
        <View accessibilityRole="tablist" style={styles.tabs}>
          {tabs.map(item => {
            const on = item.id === shownTab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{selected: on}}
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[styles.tab, on ? styles.tabOn : null]}
                testID={`lesson-content-tab-${item.id}`}
              >
                <AppText
                  numberOfLines={1}
                  style={[styles.tabText, on ? styles.tabTextOn : null]}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.card}>
        {shownTab === 'words' ? (
          <>
            {words.slice(0, WORD_PREVIEW).map((entry, index) => (
              <View
                key={entry.key}
                style={[styles.row, index > 0 ? styles.divider : null]}
                testID={`lesson-content-word-${entry.key}`}
              >
                {showPictures ? (
                  <View style={styles.thumb}>
                    <LibraryCover
                      compact
                      glyph="cards"
                      imageUrl={
                        entry.itemId
                          ? (itemImages.get(entry.itemId) ?? null)
                          : null
                      }
                      shape="pack"
                      testID={`lesson-content-thumb-${entry.itemId ?? entry.key}`}
                    />
                  </View>
                ) : null}
                <View style={styles.rowText}>
                  <View style={styles.wordLine}>
                    <AppText style={styles.word}>{entry.word}</AppText>
                    {entry.ipa ? (
                      <AppText color="muted" variant="caption">
                        {formatIpa(entry.ipa)}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText
                    color="secondary"
                    numberOfLines={1}
                    variant="caption"
                  >
                    {entry.meaning}
                  </AppText>
                </View>
                {onSpeakText ? (
                  <IconButton
                    accessibilityHint={t('lessonPlayer.speak_word_hint')}
                    accessibilityLabel={t('lessonPlayer.speak_word', {
                      word: entry.word,
                    })}
                    icon="volume_up"
                    iconSize={18}
                    onPress={() => onSpeakText(entry.word)}
                    size={36}
                    style={styles.speak}
                    testID={`lesson-content-speak-word-${entry.key}`}
                  />
                ) : null}
              </View>
            ))}
            <Pressable
              accessibilityHint={t('lessonPlayer.item_rail_all_hint')}
              accessibilityRole="button"
              onPress={onOpenWords}
              style={[styles.more, styles.divider]}
              testID="lesson-content-words-all"
            >
              <AppText color="primary" variant="label">
                {t('lessonPlayer.words_all', {count: words.length})}
              </AppText>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.viBar}>
              <AppText color="muted" variant="label">
                {t('lessonPlayer.sentences_range', {
                  shown: visibleSentences.length,
                  total: sentences.length,
                })}
              </AppText>
              <View style={styles.viSwitch}>
                <AppText variant="label">
                  {t('lessonPlayer.show_vietnamese')}
                </AppText>
                <Switch
                  accessibilityHint={t('lessonPlayer.show_vietnamese_hint')}
                  accessibilityLabel={t('lessonPlayer.show_vietnamese')}
                  onValueChange={setShowVi}
                  testID="lesson-content-vi-toggle"
                  thumbColor={theme.colors.surface}
                  trackColor={{
                    false: theme.colors.outlineVariant,
                    true: theme.colors.primary,
                  }}
                  value={showVi}
                />
              </View>
            </View>
            {visibleSentences.map((sentence, index) => (
              <View
                key={sentence.id}
                style={[styles.row, styles.sentenceRow, styles.divider]}
                testID={`lesson-content-sentence-${sentence.id}`}
              >
                <AppText color="muted" style={styles.number}>
                  {index + 1}
                </AppText>
                <View style={styles.rowText}>
                  <AppText variant="bodyLg">{sentence.text_en}</AppText>
                  {showVi ? (
                    <AppText
                      color="muted"
                      testID={`lesson-content-sentence-vi-${sentence.id}`}
                    >
                      {sentence.text_vi}
                    </AppText>
                  ) : null}
                </View>
                {onSpeakText ? (
                  <IconButton
                    accessibilityHint={t('lessonPlayer.speak_sentence_hint')}
                    accessibilityLabel={t('lessonPlayer.speak_sentence', {
                      index: index + 1,
                    })}
                    icon="volume_up"
                    iconSize={16}
                    onPress={() => onSpeakText(sentence.text_en)}
                    size={32}
                    style={styles.speak}
                    testID={`lesson-content-speak-sentence-${sentence.id}`}
                  />
                ) : null}
              </View>
            ))}
            {sentences.length > SENTENCE_PREVIEW ? (
              <Pressable
                accessibilityHint={t('lessonPlayer.content_toggle_hint')}
                accessibilityRole="button"
                onPress={() => setExpanded(value => !value)}
                style={[styles.more, styles.divider]}
                testID="canonical-hub-expand"
              >
                <AppText color="primary" variant="label">
                  {expanded
                    ? `${t('lessonPlayer.content_show_less')} ↑`
                    : t('lessonPlayer.sentences_all', {
                        count: sentences.length,
                      })}
                </AppText>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.sm,
    },
    // Floating pill bar, apart from the card under it.
    tabs: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 2,
      padding: 4,
      ...getStickerFace(theme, 3),
    },
    tab: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      flex: 1,
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    tabOn: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      color: theme.colors.text.muted,
      fontSize: 13.5,
      fontWeight: '700',
    },
    tabTextOn: {
      color: theme.colors.text.inverse,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      overflow: 'hidden',
      ...getStickerFace(theme, 4),
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    sentenceRow: {
      alignItems: 'flex-start',
    },
    divider: {
      borderTopColor: theme.colors.surfaceMuted,
      borderTopWidth: 1.5,
    },
    thumb: {
      borderRadius: 12,
      height: 44,
      overflow: 'hidden',
      width: 44,
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
    word: {
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '700',
    },
    number: {
      fontSize: 12,
      fontWeight: '800',
      paddingTop: 3,
      width: 16,
    },
    speak: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 12,
    },
    viBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    viSwitch: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    more: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
  });
}
