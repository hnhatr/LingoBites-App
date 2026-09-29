import React from 'react';
import {Text, View} from 'react-native';
import {useAppTheme} from '@ui/theme';
import {blockBaseStyles} from '../logic/blockStyles';
import type {CurriculumLessonGrammarBlockData} from '../logic/curriculumLessonSchema';

type Props = {
  data: CurriculumLessonGrammarBlockData;
};

/**
 * Renders a `grammar` block: the pattern name in both languages, the
 * pattern formula, a Vietnamese explanation, and usage examples.
 * All content is display-only.
 */
export function GrammarBlockView({data}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  return (
    <View testID="block-grammar">
      <Text testID="block-grammar-name-en" style={styles.title}>
        {data.nameEn}
      </Text>
      <Text testID="block-grammar-name-vi" style={styles.body}>
        {data.nameVi}
      </Text>
      <Text testID="block-grammar-pattern" style={styles.body}>
        {data.pattern}
      </Text>
      <Text testID="block-grammar-explanation" style={styles.secondary}>
        {data.explanationVi}
      </Text>
      {data.examples.map((example, index) => (
        <View key={index} testID={`block-grammar-example-${index}`}>
          <Text
            testID={`block-grammar-example-en-${index}`}
            style={styles.body}
          >
            {example.en}
          </Text>
          <Text
            testID={`block-grammar-example-vi-${index}`}
            style={styles.secondary}
          >
            {example.vi}
          </Text>
        </View>
      ))}
    </View>
  );
}
