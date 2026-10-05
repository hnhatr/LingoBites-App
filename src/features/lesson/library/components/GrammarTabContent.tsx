import React, {useCallback, useMemo} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';

import {useBookmarkOptimistic} from '@features/review';

import {useFloatingTabBarClearance} from '@ui/components/layout';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import type {GrammarBookmark, SaveGrammarBookmarkInput} from '@core/db/types';
import {useAppNavigation} from '@core/navigation';

import {GrammarRowCard} from './GrammarRowCard';
import {LibraryEmptyState} from './LibraryEmptyState';

export interface GrammarTabContentProps {
  grammar: (GrammarBookmark & {title?: string; content?: string})[];
  /** A search/source filter is active, so an empty list means no matches. */
  isFiltered?: boolean;
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

export function GrammarTabContent({
  grammar,
  isFiltered = false,
}: GrammarTabContentProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const navigation = useAppNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {grammarSaveState, onGrammarSave, onGrammarUnsave} =
    useBookmarkOptimistic();

  const handleCardPress = useCallback(
    (bookmark: GrammarBookmark & {title?: string; content?: string}) => {
      // No grammar detail screen yet: open the lesson the point came from.
      navigation.openLesson(bookmark.lessonId);
    },
    [navigation],
  );

  const handleSave = useCallback(
    (bookmark: GrammarBookmark) => {
      const input: SaveGrammarBookmarkInput = {
        lessonId: bookmark.lessonId,
        grammarId: bookmark.grammarId,
        packageId: bookmark.packageId,
      };
      onGrammarSave(bookmark.grammarId, input);
    },
    [onGrammarSave],
  );

  const handleUnsave = useCallback(
    (bookmark: GrammarBookmark) => {
      onGrammarUnsave(bookmark.grammarId, bookmark.lessonId);
    },
    [onGrammarUnsave],
  );

  const renderItem = useCallback(
    ({item}: {item: GrammarBookmark & {title?: string; content?: string}}) => {
      const isSaved = grammarSaveState.getIsSaved(item.grammarId, true);

      return (
        <GrammarRowCard
          grammar={item}
          isSaved={isSaved}
          onSave={() => handleSave(item)}
          onUnsave={() => handleUnsave(item)}
          onPress={() => handleCardPress(item)}
          testID={`grammar-card-${item.grammarId}`}
        />
      );
    },
    [grammarSaveState, handleSave, handleUnsave, handleCardPress],
  );

  if (grammar.length === 0) {
    return <LibraryEmptyState type={isFiltered ? 'no-results' : 'grammar'} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[
          styles.contentContainer,
          {paddingBottom: feedClearance},
        ]}
        data={grammar}
        keyExtractor={item => item.grammarId}
        renderItem={renderItem}
        testID="grammar-flat-list"
      />
    </View>
  );
}
