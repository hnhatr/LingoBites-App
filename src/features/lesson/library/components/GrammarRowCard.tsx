import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {SaveToggle} from '@ui/components/SaveToggle';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import type {GrammarBookmark} from '@core/db/types';

export interface GrammarRowCardProps {
  grammar: GrammarBookmark & {title?: string; content?: string};
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
    title: {
      marginBottom: theme.spacing.xs,
    },
    content: {
      marginBottom: 0,
    },
    bookmarkButton: {
      flexShrink: 0,
    },
  });
}

export function GrammarRowCard({
  grammar,
  isSaved,
  onSave,
  onUnsave,
  onPress,
  testID,
}: GrammarRowCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleBookmarkPress = () => {
    if (isSaved) {
      onUnsave();
    } else {
      onSave();
    }
  };

  const grammarTitle = grammar.title || '';
  const grammarContent = grammar.content || '';

  const content = (
    <AppCard>
      <View style={styles.innerContainer}>
        <View style={styles.contentWrapper}>
          <AppText
            variant="h3"
            style={styles.title}
            testID="grammar-title-text"
          >
            {grammarTitle}
          </AppText>
          <AppText
            variant="label"
            color="secondary"
            style={styles.content}
            testID="grammar-content-text"
          >
            {grammarContent}
          </AppText>
        </View>
        <SaveToggle
          accessibilityHint={
            isSaved ? 'Bỏ khỏi danh sách đã lưu' : 'Thêm vào danh sách đã lưu'
          }
          accessibilityLabel={
            isSaved ? 'Bỏ lưu quy tắc ngữ pháp này' : 'Lưu quy tắc ngữ pháp này'
          }
          onPress={handleBookmarkPress}
          raised="row"
          saved={isSaved}
          style={styles.bookmarkButton}
          testID="save-button"
        />
      </View>
    </AppCard>
  );

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${grammarTitle} - ${grammarContent}`}
        onPress={onPress}
        testID="grammar-card-pressable"
        style={styles.pressable}
      >
        {content}
      </Pressable>
    </View>
  );
}
