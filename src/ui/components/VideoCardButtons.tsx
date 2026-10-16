import {BlurView} from 'expo-blur';
import React, {type RefObject} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Defs, G, LinearGradient, Path, Stop, Svg} from 'react-native-svg';

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

/** Path data copied from `assets/svg/bookmark_3d.svg` (viewBox 0 0 26 31). */
const BOOKMARK =
  'M7 2h12a2.5 2.5 0 0 1 2.5 2.5V27L13 20.5 4.5 27V4.5A2.5 2.5 0 0 1 7 2z';
const TICK = 'M8.6 11l3.2 3.2 5.8-6.4';
/** How far the raised icon stands above its base. */
const LIFT = 2.6;

const GREEN = '#22C55E';
const GREEN_BASE = '#15803D';
const GREEN_SHADE = '#0B3D1F';
const GREEN_LIGHT = '#86EFAC';

const SAVE_BLUR_INTENSITY = 10;
/** Frosted square behind the bookmark: a dark tint, a light one once saved. */
const SAVE_FACE_OFF = 'rgba(0,0,0,0.1)';
const SAVE_FACE_ON = 'rgba(255,255,255,0.4)';

export interface VideoSaveButtonProps {
  saved: boolean;
  onToggle: () => void;
  /** The picture behind the button, for the frosted face on Android. */
  blurTarget?: RefObject<View | null>;
  testID?: string;
}

/**
 * The save toggle on a video card's picture: a green bookmark in a frosted
 * square. Unsaved, the bookmark is sunk into its base; saved, it stands up
 * on a darker base with a white tick, on a light square.
 */
export function VideoSaveButton({
  saved,
  onToggle,
  blurTarget,
  testID,
}: VideoSaveButtonProps) {
  return (
    <Pressable
      accessibilityHint={
        saved ? 'Bỏ bài khỏi danh sách đã lưu' : 'Thêm bài vào danh sách đã lưu'
      }
      accessibilityLabel={saved ? 'Bỏ lưu bài' : 'Lưu bài'}
      accessibilityRole="button"
      accessibilityState={{selected: saved}}
      hitSlop={6}
      onPress={onToggle}
      style={styles.save}
      testID={testID}
    >
      <BlurView
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget}
        intensity={SAVE_BLUR_INTENSITY}
        style={[
          styles.saveFace,
          saved ? styles.saveFaceOn : styles.saveFaceOff,
        ]}
      >
        <View style={saved ? styles.raisedGlow : null}>
          <BookmarkIcon saved={saved} />
        </View>
      </BlurView>
    </Pressable>
  );
}

function BookmarkIcon({saved}: {saved: boolean}) {
  return (
    <Svg
      accessibilityElementsHidden
      height={22}
      importantForAccessibility="no"
      viewBox="0 0 26 31"
      width={18}
    >
      {saved ? (
        <G strokeLinejoin="round">
          <Path
            d={BOOKMARK}
            fill={GREEN_BASE}
            stroke={GREEN_BASE}
            strokeWidth={1.6}
            transform={`translate(0 ${LIFT})`}
          />
          <Path d={BOOKMARK} fill={GREEN} stroke={GREEN} strokeWidth={1.6} />
          <Path
            d={TICK}
            fill="none"
            stroke="#FFFFFF"
            strokeLinecap="round"
            strokeWidth={2.6}
          />
        </G>
      ) : (
        <G strokeLinejoin="round">
          <Defs>
            <LinearGradient id="bookmarkSunk" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={GREEN_BASE} />
              <Stop offset="1" stopColor={GREEN} />
            </LinearGradient>
          </Defs>
          {/* A dark edge above and a light lip below: pressed in. */}
          <Path
            d={BOOKMARK}
            fill="none"
            stroke={GREEN_SHADE}
            strokeWidth={1.6}
            transform="translate(0 1.5)"
          />
          <Path
            d={BOOKMARK}
            fill="none"
            stroke={GREEN_LIGHT}
            strokeWidth={1.2}
            transform="translate(0 4)"
          />
          <Path
            d={BOOKMARK}
            fill="url(#bookmarkSunk)"
            stroke={GREEN_BASE}
            strokeWidth={1}
            transform={`translate(0 ${LIFT})`}
          />
        </G>
      )}
    </Svg>
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
  save: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
  saveFace: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 34,
  },
  saveFaceOff: {
    backgroundColor: SAVE_FACE_OFF,
  },
  saveFaceOn: {
    backgroundColor: SAVE_FACE_ON,
  },
  // A soft green glow under the raised bookmark (iOS).
  raisedGlow: {
    shadowColor: GREEN,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.45,
    shadowRadius: 3,
  },
});
