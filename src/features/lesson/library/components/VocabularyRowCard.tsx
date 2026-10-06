import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import type {FlashcardRecord} from '@core/db/types';

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
    innerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    contentWrapper: {
      flex: 1,
    },
    word: {
      marginBottom: theme.spacing.xs,
    },
    meaning: {
      marginBottom: theme.spacing.sm,
    },
    meaningNoExample: {
      marginBottom: 0,
    },
    example: {
      marginTop: theme.spacing.sm,
      fontStyle: 'italic',
    },
    phonetic: {
      marginBottom: theme.spacing.xs,
    },
    bookmarkButton: {
      flexShrink: 0,
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
  const phonetic = [
    flashcard.wordType ? `[${flashcard.wordType}]` : '',
    flashcard.ipa ? flashcard.ipa : '',
  ]
    .filter(Boolean)
    .join(' ');

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

  return (
    <View style={styles.container} testID={testID}>
      <AppCard>
        <View style={styles.innerContainer}>
          {/* Only the text is the card button: the save heart and the source
              list are siblings, so assistive tech can reach each of them. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${flashcard.word} - ${flashcard.meaningVi}`}
            onPress={handleCardPress}
            testID="vocabulary-card-pressable"
            style={styles.contentWrapper}
          >
            <AppText variant="h3" style={styles.word} testID="word-text">
              {flashcard.word}
            </AppText>
            {phonetic ? (
              <AppText
                variant="caption"
                color="muted"
                style={styles.phonetic}
                testID="phonetic-text"
              >
                {phonetic}
              </AppText>
            ) : null}
            <AppText
              variant="label"
              color="secondary"
              style={[
                styles.meaning,
                !flashcard.example && styles.meaningNoExample,
              ]}
              testID="meaning-text"
            >
              {flashcard.meaningVi}
            </AppText>
            {flashcard.example && (
              <AppText
                variant="caption"
                color="muted"
                style={styles.example}
                testID="example-text"
              >
                {flashcard.example}
              </AppText>
            )}
          </Pressable>
          <IconButton
            accessibilityLabel={
              isSaved
                ? t('library.vocabulary.unsave_a11y')
                : t('library.vocabulary.save_a11y')
            }
            icon={isSaved ? 'heart' : 'heart_outline'}
            onPress={handleBookmarkPress}
            size={40}
            iconSize={22}
            tone="bare"
            testID="save-button"
            style={styles.bookmarkButton}
          />
        </View>
        {hasManySources ? (
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
        ) : null}
        {hasManySources && sourcesOpen ? (
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
      </AppCard>
    </View>
  );
}
