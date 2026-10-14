import React, {useContext, useMemo} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {type CoverGlyph, LibraryCover} from '@ui/components/LibraryCover';
import {type AppTheme, useAppTheme} from '@ui/theme';

/** Height of the picture below the status bar. */
export const HERO_HEIGHT = 180;
/** How far the content sheet slides up over the picture. */
const SHEET_OVERLAP = 32;
/** Fade under the status bar so its text stays readable on any picture. */
const TOP_FADE = 96;

type Props = {
  imageUrl?: string | null;
  /** CEFR level code: colours the default cover. */
  level?: string | null;
  glyph: CoverGlyph;
  testID: string;
  /** Content of the sheet that overlaps the picture's bottom edge. */
  children?: React.ReactNode;
};

/**
 * The picture at the top of a course or unit, edge to edge and up under the
 * status bar (the admin's cover, else a default cover in the level colour),
 * with the page's content on a rounded sheet over its bottom edge. Used as
 * a list header: the screen leaves out the top safe-area edge and draws
 * `CurriculumHeroChrome` over the list.
 */
export function CurriculumHeroCover({
  imageUrl,
  level,
  glyph,
  testID,
  children,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const height = HERO_HEIGHT + topInset;

  return (
    <View style={themedStyles.bleed}>
      <View style={{height}}>
        <LibraryCover
          aspectRatio={width > 0 ? width / height : undefined}
          glyph={glyph}
          hideLevelChip
          imageUrl={imageUrl}
          level={level}
          shape="lesson"
          testID={testID}
        />
        <Svg
          height={topInset + TOP_FADE}
          pointerEvents="none"
          style={styles.fade}
          width="100%"
        >
          <Defs>
            <LinearGradient id="heroFade" x1="0" x2="0" y1="0" y2="1">
              <Stop
                offset="0"
                stopColor={theme.colors.background}
                stopOpacity={0.85}
              />
              <Stop
                offset="1"
                stopColor={theme.colors.background}
                stopOpacity={0}
              />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#heroFade)" height="100%" width="100%" />
        </Svg>
      </View>
      <View style={themedStyles.sheet}>{children}</View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // The list pads its content; the picture runs past that padding.
    bleed: {
      marginHorizontal: -theme.gutter,
      marginTop: -theme.spacing.sm,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: SHEET_OVERLAP,
      borderTopRightRadius: SHEET_OVERLAP,
      gap: theme.spacing.md,
      marginTop: -SHEET_OVERLAP,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.lg,
    },
  });
}

const styles = StyleSheet.create({
  fade: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
