import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {WordCard} from '@ui/components/WordCard';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import type {FlashcardRecord} from '@core/db/types';
import {renderFrameWithLabels} from '@core/learning';

import type {LibraryVocabularySource} from '../logic/useLibrarySegments';

export interface VocabularyRowCardProps {
  flashcard: FlashcardRecord;
  isSaved: boolean;
  onSave: () => void;
  onUnsave: () => void;
  /** Opens the card's only lesson (used when it has a single source). */
  onPress: () => void;
  /**
   * Lessons the word was saved from. With more than one, the card lists them
   * (tap to expand) instead of opening an arbitrary one.
   */
  sources?: LibraryVocabularySource[];
  onOpenSource?: (lessonId: string) => void;
  testID?: string;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    sources: {
      flexBasis: '100%',
    },
    sourcesToggle: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
    },
    sourcesList: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    sourceRow: {
      minHeight: 44,
      justifyContent: 'center',
    },
  });
}

export function VocabularyRowCard({
  flashcard,
  isSaved,
  onSave,
  onUnsave,
  onPress,
  sources = [],
  onOpenSource,
  testID,
}: VocabularyRowCardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const hasManySources = sources.length > 1;

  // One source: the card opens it. Several: the card toggles the list so the
  // learner picks which lesson to open.
  const handleCardPress = hasManySources
    ? () => setSourcesOpen(open => !open)
    : onPress;

  const handleBookmarkPress = () => {
    if (isSaved) {
      onUnsave();
    } else {
      onSave();
    }
  };

  const sourcesBlock = hasManySources ? (
    <View style={styles.sources}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          sourcesOpen
            ? t('library.vocabulary.sources_toggle_hide_a11y', {
                word: flashcard.word,
              })
            : t('library.vocabulary.sources_toggle_show_a11y', {
                count: sources.length,
                word: flashcard.word,
              })
        }
        accessibilityHint={t('library.vocabulary.sources_toggle_hint')}
        accessibilityState={{expanded: sourcesOpen}}
        onPress={() => setSourcesOpen(open => !open)}
        style={styles.sourcesToggle}
        testID="sources-toggle"
      >
        <AppText variant="caption" color="primary">
          {t('library.vocabulary.sources_count', {count: sources.length})}
          {' · '}
          {sourcesOpen
            ? t('library.vocabulary.sources_hide')
            : t('library.vocabulary.sources_show')}
        </AppText>
      </Pressable>
      {sourcesOpen ? (
        <View style={styles.sourcesList} testID="sources-list">
          {sources.map(source => {
            const title =
              source.title ?? t('library.vocabulary.source_untitled');
            return (
              <Pressable
                key={source.lessonId}
                accessibilityRole="button"
                accessibilityLabel={t('library.vocabulary.source_open_a11y', {
                  title,
                })}
                accessibilityHint={t('library.vocabulary.source_open_hint')}
                onPress={() => onOpenSource?.(source.lessonId)}
                style={styles.sourceRow}
                testID={`source-row-${source.lessonId}`}
              >
                <AppText variant="label" color="secondary">
                  {title}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  ) : undefined;

  // A saved sentence pattern shows its frame with the slots blanked and a
  // "Mẫu câu" tag where a word shows its part of speech.
  const pattern = flashcard.kind === 'pattern';
  const word = pattern ? renderFrameWithLabels(flashcard.word) : flashcard.word;

  return (
    <View style={styles.container} testID={testID}>
      {/* Only the text is the card button: the bookmark and the source list
          are siblings, so assistive tech can reach each of them. */}
      <WordCard
        actions={sourcesBlock}
        cefr={flashcard.cefrLevel}
        example={flashcard.example}
        exampleTranslation={flashcard.exampleTranslation}
        ipa={flashcard.ipa}
        meaning={flashcard.meaningVi}
        onPress={handleCardPress}
        pos={pattern ? t('lessonPlayer.item_kind_pattern') : flashcard.wordType}
        pressAccessibilityLabel={`${word} - ${flashcard.meaningVi}`}
        pressTestID="vocabulary-card-pressable"
        trailing={
          <IconButton
            accessibilityLabel={
              isSaved
                ? t('library.vocabulary.unsave_a11y')
                : t('library.vocabulary.save_a11y')
            }
            icon={isSaved ? 'bookmark' : 'bookmark_add'}
            onPress={handleBookmarkPress}
            size={40}
            iconSize={22}
            tone="bare"
            testID="save-button"
          />
        }
        word={word}
      />
    </View>
  );
}
