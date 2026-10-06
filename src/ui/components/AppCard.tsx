import React from 'react';
import {View, type ViewProps} from 'react-native';

import {useAppTheme} from '../theme';
import {getStickerFace} from '../theme/hardShadow';
import {ShelfSurface} from './ShelfSurface';

export function AppCard({style, children, ...rest}: ViewProps) {
  const {theme} = useAppTheme();
  const spec = theme.components.card;
  const shelf = theme.shelf ? theme.shelf.surface : undefined;
  // Light/Dark share Home's sticker look: 2px ink outline + hard shadow on an
  // opaque face. Other themes keep their own shadow.
  const stickerFace = getStickerFace(theme, 4);
  const shadowStyle =
    spec.shadow && !stickerFace ? theme.shadow[spec.shadow] : undefined;

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
