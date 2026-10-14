import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {HERO_PALETTE} from '../theme/heroPalette';

/**
 * The mint-to-sky face of the bright main cards, drawn behind a card's
 * content. The parent sets `overflow: 'hidden'` and its own radius; give
 * each fill on a screen its own `id`.
 */
export function HeroFill({id}: {id: string}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id={id} x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={HERO_PALETTE.faceFrom} />
            <Stop offset="1" stopColor={HERO_PALETTE.faceTo} />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height="100%" width="100%" />
      </Svg>
    </View>
  );
}
