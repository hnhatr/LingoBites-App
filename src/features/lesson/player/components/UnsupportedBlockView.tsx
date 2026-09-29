import React from 'react';
import {Text, View} from 'react-native';
import {useAppTheme} from '@ui/theme/index';
import {blockBaseStyles} from '../logic/blockStyles';
import type {CurriculumLessonUnsupportedBlock} from '../logic/curriculumLessonSchema';

type Props = {
  block: CurriculumLessonUnsupportedBlock;
};

/**
 * Safe placeholder for one unknown or malformed block. The player renders
 * this inline and continues with the remaining blocks, so a single bad
 * block never crashes the lesson.
 */
export function UnsupportedBlockView({block}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const positionSuffix =
    block.position !== null ? ` at position ${block.position}` : '';
  return (
    <View
      testID="block-unsupported"
      accessibilityRole="text"
      accessibilityLabel={`Unsupported lesson content${positionSuffix}`}
      accessibilityHint="Placeholder for an unsupported block; continue to the next part"
    >
      <View style={styles.fallbackBox}>
        <Text testID="block-unsupported-message" style={styles.fallbackText}>
          This part of the lesson cannot be shown yet. You can safely continue
          to the next part.
        </Text>
      </View>
    </View>
  );
}
