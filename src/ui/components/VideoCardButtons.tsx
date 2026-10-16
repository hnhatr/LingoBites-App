import React from 'react';
import {StyleSheet, View} from 'react-native';

import {Glyph} from '@ui/components/LibraryCover';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {solidOver} from '@ui/theme/colorUtils';

/** Size of the play button over a video card's picture. */
export const VIDEO_PLAY_SIZE = {width: 58, height: 42} as const;

/**
 * The play button over a video card's picture: a rounded block in the card's
 * ink on a darker base, like the app's sticker buttons.
 */
export function VideoPlayButton({ink}: {ink: string}) {
  return (
    <View pointerEvents="none">
      <ShelfSurface
        borderRadius={14}
        faceStyle={[styles.playFace, {backgroundColor: ink}]}
        shelfColor={solidOver('rgba(0,0,0,0.3)', ink)}
        shelfHeight={4}
      >
        <Glyph color="#FFFFFF" name="play" size={26} />
      </ShelfSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  playFace: {
    alignItems: 'center',
    height: VIDEO_PLAY_SIZE.height,
    justifyContent: 'center',
    paddingLeft: 3,
    width: VIDEO_PLAY_SIZE.width,
  },
});
