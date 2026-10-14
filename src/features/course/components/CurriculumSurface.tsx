import React from 'react';
import {type StyleProp, StyleSheet, type ViewStyle} from 'react-native';

import {ShelfSurface} from '@ui/components/ShelfSurface';
import {useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

type Props = {
  /** The step to take next: accent outline and accent shelf. */
  highlighted?: boolean;
  pressed?: boolean;
  faceStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
};

/**
 * The card face of a curriculum route stop (unit or lesson): the theme's
 * card with its shelf, as `AppCard`, plus an accent outline on the step to
 * take next.
 */
export function CurriculumSurface({
  highlighted = false,
  pressed = false,
  faceStyle,
  containerStyle,
  testID,
  children,
}: Props) {
  const {theme} = useAppTheme();
  const spec = theme.components.card;
  const shelf = highlighted ? theme.shelf?.accent : theme.shelf?.surface;
  const stickerFace = getStickerFace(theme, 4);
  const shadowStyle =
    spec.shadow && !stickerFace ? theme.shadow[spec.shadow] : undefined;

  return (
    <ShelfSurface
      borderRadius={spec.radius}
      containerStyle={[shadowStyle, containerStyle]}
      containerTestID={testID}
      faceStyle={[
        styles.face,
        {backgroundColor: spec.background},
        stickerFace,
        highlighted && [styles.highlighted, {borderColor: theme.colors.accent}],
        faceStyle,
      ]}
      isPressed={pressed}
      shelfColor={shelf?.color}
      shelfHeight={shelf?.height}
    >
      {children}
    </ShelfSurface>
  );
}

const styles = StyleSheet.create({
  face: {
    padding: 14,
  },
  highlighted: {
    borderWidth: 2,
  },
});
