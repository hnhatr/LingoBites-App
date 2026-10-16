import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {HERO_PALETTE} from '../theme/heroPalette';
import {MaterialIcon} from './MaterialIcon';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const BORDER = 1.5;
const THUMB = 25;
const INSET = 2;
/** How far the thumb slides, inside the border on both sides. */
const TRAVEL = TRACK_WIDTH - BORDER * 2 - THUMB - INSET * 2;

export interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The app's one on/off switch, the same on iOS and Android. Off: a beige
 * track with a clear rim and a raised white thumb, so it stays visible on a
 * white card. On: a mint track on a darker shelf, the thumb showing a tick.
 */
export function AppSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: AppSwitchProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const slide = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      duration: 180,
      toValue: value ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [slide, value]);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{checked: value, disabled}}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        value ? styles.trackOn : null,
        disabled ? styles.disabled : null,
        style,
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.thumb,
          value ? styles.thumbOn : null,
          {
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, TRAVEL],
                }),
              },
            ],
          },
        ]}
      >
        {value ? (
          <MaterialIcon color={theme.colors.primary} name="check" size={16} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  // Rim of the off track and edge under the thumb: a shade below the track.
  const rim = theme.colors.outlineVariant;
  return StyleSheet.create({
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderColor: rim,
      borderRadius: TRACK_HEIGHT / 2,
      borderWidth: BORDER,
      height: TRACK_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: INSET,
      width: TRACK_WIDTH,
    },
    trackOn: {
      backgroundColor: theme.colors.accent,
      borderColor: HERO_PALETTE.shelf,
    },
    thumb: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.white,
      borderRadius: THUMB / 2,
      height: THUMB,
      justifyContent: 'center',
      width: THUMB,
      ...getStickerEdge(2, rim),
    },
    thumbOn: {
      ...getStickerEdge(2, HERO_PALETTE.ghostShelf),
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
  });
}
