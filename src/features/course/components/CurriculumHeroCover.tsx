import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {type CoverGlyph, LibraryCover} from '@ui/components/LibraryCover';
import {type AppTheme, useAppTheme} from '@ui/theme';

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
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    frame: {
      borderColor: theme.colors.ink,
      borderRadius: 18,
      borderWidth: 2,
      overflow: 'hidden',
    },
  });
}
