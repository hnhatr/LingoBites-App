import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';

import {useBookmarkOptimistic} from '@features/review';

import {useFloatingTabBarClearance} from '@ui/components/layout';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import type {FlashcardRecord} from '@core/db/types';
import type {SaveFlashcardInput} from '@core/db/types';

import type {LessonsStackParamList} from '../screens/navigationTypes';
import {LibraryEmptyState} from './LibraryEmptyState';
import {VocabularyRowCard} from './VocabularyRowCard';

export interface VocabularyTabContentProps {
  vocabulary: FlashcardRecord[];
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
  });
}

export function VocabularyTabContent({vocabulary}: VocabularyTabContentProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<LessonsStackParamList>>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {vocabularySaveState, onVocabularySave, onVocabularyUnsave} =
    useBookmarkOptimistic();

  const handleCardPress = useCallback(
    (flashcard: FlashcardRecord) => {
      // Navigate to FlashcardDetail with vocabularyId
      navigation.navigate('FlashcardDetail' as any, {
        vocabularyId: flashcard.vocabularyId,
      });
    },
    [navigation],
  );

  const handleSave = useCallback(
    (flashcard: FlashcardRecord) => {
      const input: SaveFlashcardInput = {
        lessonId: flashcard.lessonId,
        vocabulary: {
          id: flashcard.vocabularyId,
          word: flashcard.word,
          phrase_from_text: flashcard.phraseFromText ?? undefined,
          word_type: flashcard.wordType ?? undefined,
          meaning_vi: flashcard.meaningVi,
          pronunciation_guide_vi: flashcard.pronunciationGuideVi ?? undefined,
          ipa: flashcard.ipa ?? undefined,
          cefr_level: flashcard.cefrLevel ?? undefined,
          source_sentence: flashcard.sourceSentence ?? undefined,
          example: flashcard.example ?? undefined,
          example_translation: flashcard.exampleTranslation ?? undefined,
        },
      };
      onVocabularySave(flashcard.id, input);
    },
    [onVocabularySave],
  );

  const handleUnsave = useCallback(
    (flashcard: FlashcardRecord) => {
      onVocabularyUnsave(flashcard.id);
    },
    [onVocabularyUnsave],
  );

  const renderItem = useCallback(
    ({item}: {item: FlashcardRecord}) => {
      const isSaved = vocabularySaveState.getIsSaved(item.id, item.isSaved);

      return (
        <VocabularyRowCard
          flashcard={item}
          isSaved={isSaved}
          onSave={() => handleSave(item)}
          onUnsave={() => handleUnsave(item)}
          onPress={() => handleCardPress(item)}
          testID={`vocabulary-card-${item.id}`}
        />
      );
    },
    [vocabularySaveState, handleSave, handleUnsave, handleCardPress],
  );

  if (vocabulary.length === 0) {
    return <LibraryEmptyState type="vocabulary" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[
          styles.contentContainer,
          {paddingBottom: feedClearance},
        ]}
        data={vocabulary}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        testID="vocabulary-flat-list"
      />
    </View>
  );
}
