import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {type AppTheme, useAppTheme} from '@ui/theme';

import {blockBaseStyles} from '../logic/blockStyles';
import type {CurriculumLessonVocabularyItem} from '../logic/curriculumLessonSchema';

type Props = {
  items: CurriculumLessonVocabularyItem[];
};

function extraStyles(theme: AppTheme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.sm,
    },
    row: {
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
    },
    lemmaRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    lemma: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.bold,
    },
    ipa: {
      color: theme.colors.text.muted,
      fontSize: theme.typography.size.sm,
    },
    meaning: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.md,
    },
  });
}

/**
 * Renders a `vocabulary` block: items in the order the Server sent them
 * (already ordered by `lesson_block_vocabularies.position`). Nullable
 * `ipa`/`audio`/`image` fields degrade to compact fallbacks, never crashes.
 */
export function VocabularyBlockView({items}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const extra = extraStyles(theme);
  if (items.length === 0) {
    return (
      <View testID="block-vocabulary" style={styles.fallbackBox}>
        <Text testID="block-vocabulary-empty" style={styles.fallbackText}>
          No vocabulary items in this block.
        </Text>
      </View>
    );
  }
  return (
    <View testID="block-vocabulary" style={extra.list}>
      {items.map(item => (
        <View
          key={item.id}
          testID={`vocabulary-item-${item.id}`}
          style={extra.row}
        >
          <View style={extra.lemmaRow}>
            <Text testID={`vocabulary-lemma-${item.id}`} style={extra.lemma}>
              {item.lemma}
            </Text>
            {item.ipa ? (
              <Text testID={`vocabulary-ipa-${item.id}`} style={extra.ipa}>
                {item.ipa}
              </Text>
            ) : null}
          </View>
          <Text testID={`vocabulary-meaning-${item.id}`} style={extra.meaning}>
            {item.meaning}
          </Text>
          {item.audio || item.image ? null : (
            <Text
              testID={`vocabulary-no-media-${item.id}`}
              style={styles.caption}
            >
              No audio or image for this word.
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
