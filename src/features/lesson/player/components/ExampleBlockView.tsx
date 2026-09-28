import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import {blockBaseStyles} from '../logic/blockStyles';
import type {CurriculumLessonExampleBlockData} from '../logic/curriculumLessonSchema';

type Props = {
  data: CurriculumLessonExampleBlockData;
};

function extraStyles(theme: AppTheme) {
  return StyleSheet.create({
    highlightRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    highlightChip: {
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    highlightText: {
      color: theme.colors.onSecondaryContainer,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.medium,
    },
  });
}

/** Renders an `example` block: source sentence, translation, highlights. */
export function ExampleBlockView({data}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const extra = extraStyles(theme);
  return (
    <View testID="block-example">
      <Text testID="block-example-source" style={styles.body}>
        {data.source}
      </Text>
      {data.translation ? (
        <Text testID="block-example-translation" style={styles.secondary}>
          {data.translation}
        </Text>
      ) : null}
      {data.highlight && data.highlight.length > 0 ? (
        <View testID="block-example-highlights" style={extra.highlightRow}>
          {data.highlight.map(item => (
            <View key={item} style={extra.highlightChip}>
              <Text style={extra.highlightText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
