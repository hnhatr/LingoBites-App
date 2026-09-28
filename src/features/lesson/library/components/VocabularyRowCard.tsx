import React, {useMemo} from 'react';
import {Pressable, View, StyleSheet} from 'react-native';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme} from '@ui/theme/index';
import type {AppTheme} from '@ui/theme/types';
import type {FlashcardRecord} from '@core/db/types';

export interface VocabularyRowCardProps {
  flashcard: FlashcardRecord;
  isSaved: boolean;
  onSave: () => void;
  onUnsave: () => void;
  onPress: () => void;
  testID?: string;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    pressable: {
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
    bookmarkButton: {
      flexShrink: 0,
    },
  });
}

export function VocabularyRowCard({
  flashcard,
  isSaved,
  onSave,
  onUnsave,
  onPress,
  testID,
}: VocabularyRowCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleBookmarkPress = () => {
    if (isSaved) {
      onUnsave();
    } else {
      onSave();
    }
  };

  const content = (
    <AppCard>
      <View style={styles.innerContainer}>
        <View style={styles.contentWrapper}>
          <AppText variant="h3" style={styles.word} testID="word-text">
            {flashcard.word}
          </AppText>
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
        </View>
        <IconButton
          accessibilityLabel={isSaved ? 'Bỏ lưu từ này' : 'Lưu từ này'}
          icon={isSaved ? 'heart' : 'heart_outline'}
          onPress={handleBookmarkPress}
          size={40}
          iconSize={22}
          tone="bare"
          testID="save-button"
          style={styles.bookmarkButton}
        />
      </View>
    </AppCard>
  );

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${flashcard.word} - ${flashcard.meaningVi}`}
        onPress={onPress}
        testID="vocabulary-card-pressable"
        style={styles.pressable}
      >
        {content}
      </Pressable>
    </View>
  );
}
