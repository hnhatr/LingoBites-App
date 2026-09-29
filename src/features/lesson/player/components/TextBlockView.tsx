import React from 'react';
import {Text, View} from 'react-native';
import {useAppTheme} from '@ui/theme/index';
import {blockBaseStyles} from '../logic/blockStyles';
import type {CurriculumLessonTextBlockData} from '../logic/curriculumLessonSchema';

type Props = {
  data: CurriculumLessonTextBlockData;
};

const VARIANT_LABELS: Record<string, string> = {
  body: 'Reading',
  note: 'Note',
  tip: 'Tip',
  grammar: 'Grammar',
};

/** Renders a `text` block: lesson prose with an optional variant eyebrow. */
export function TextBlockView({data}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const label = data.variant ? VARIANT_LABELS[data.variant] : null;
  return (
    <View testID="block-text">
      {label ? (
        <Text testID="block-text-variant" style={styles.caption}>
          {label}
        </Text>
      ) : null}
      <Text testID="block-text-content" style={styles.body}>
        {data.content}
      </Text>
    </View>
  );
}
