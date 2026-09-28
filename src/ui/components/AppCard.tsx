import React from 'react';
import {View, type ViewProps} from 'react-native';
import {useAppTheme} from '../theme';

import {ShelfSurface} from './ShelfSurface';

export function AppCard({style, children, ...rest}: ViewProps) {
  const {theme} = useAppTheme();
  const spec = theme.components.card;
  const shelf = theme.shelf ? theme.shelf.surface : undefined;
  const shadowStyle = spec.shadow ? theme.shadow[spec.shadow] : undefined;

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
        }}
      >
        {children}
      </ShelfSurface>
    </View>
  );
}
