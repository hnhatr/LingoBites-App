import React from 'react';
import {View, type ViewProps} from 'react-native';

import {useAppTheme} from '../theme';
import {getHardShadow} from '../theme/hardShadow';
import {ShelfSurface} from './ShelfSurface';

export function AppCard({style, children, ...rest}: ViewProps) {
  const {theme} = useAppTheme();
  const spec = theme.components.card;
  const shelf = theme.shelf ? theme.shelf.surface : undefined;
  // Light/Dark share Home's sticker look: 2px ink outline + hard shadow on an
  // opaque face. Themes with a shelf (or other experimental themes) keep their
  // own shadow.
  const sticker = theme.id === 'default' || theme.id === 'dark';
  const shadowStyle =
    spec.shadow && !sticker ? theme.shadow[spec.shadow] : undefined;
  const stickerFace = sticker
    ? {
        borderColor: theme.colors.ink,
        borderWidth: 2,
        ...getHardShadow(4, theme.colors.ink),
      }
    : undefined;

  return (
    <View style={style} {...rest}>
      <ShelfSurface
        shelfHeight={shelf?.height}
        shelfColor={shelf?.color}
        borderRadius={spec.radius}
        containerStyle={shadowStyle}
        faceStyle={{
          backgroundColor: spec.background,
          padding: spec.padding,
          ...stickerFace,
        }}
      >
        {children}
      </ShelfSurface>
    </View>
  );
}
