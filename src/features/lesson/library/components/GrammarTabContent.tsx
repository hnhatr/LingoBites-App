import React, {useCallback, useMemo} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {LessonsStackParamList} from '../screens/navigationTypes';
import {useAppTheme} from '@ui/theme';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import type {AppTheme} from '@ui/theme/types';
import type {GrammarBookmark, SaveGrammarBookmarkInput} from '@core/db/types';
import {GrammarRowCard} from './GrammarRowCard';
import {LibraryEmptyState} from './LibraryEmptyState';
import {useBookmarkOptimistic} from '@features/review';

export interface GrammarTabContentProps {
  grammar: (GrammarBookmark & {title?: string; content?: string})[];
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

export function GrammarTabContent({grammar}: GrammarTabContentProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<LessonsStackParamList>>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {grammarSaveState, onGrammarSave, onGrammarUnsave} =
    useBookmarkOptimistic();

  const handleCardPress = useCallback(
    (bookmark: GrammarBookmark & {title?: string; content?: string}) => {
      navigation.navigate('GrammarDetail' as any, {
        grammarId: bookmark.grammarId,
        lessonId: bookmark.lessonId,
      });
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
    return <LibraryEmptyState type="grammar" />;
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
