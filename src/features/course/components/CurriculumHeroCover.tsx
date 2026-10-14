import React from 'react';
import {StyleSheet, View} from 'react-native';

import {type CoverGlyph, LibraryCover} from '@ui/components/LibraryCover';

type Props = {
  imageUrl?: string | null;
  /** CEFR level code: colours the default cover and shows its chip. */
  level?: string | null;
  glyph: CoverGlyph;
  testID: string;
};

/**
 * The wide picture at the top of a course or unit: the admin's cover, else
 * a default cover in the level colour with the topic icon.
 */
export function CurriculumHeroCover({imageUrl, level, glyph, testID}: Props) {
  return (
    <View style={styles.frame}>
      <LibraryCover
        aspectRatio={2.2}
        glyph={glyph}
        imageUrl={imageUrl}
        level={level}
        shape="lesson"
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    overflow: 'hidden',
  },
});
