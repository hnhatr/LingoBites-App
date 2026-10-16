import React, {useMemo, useRef} from 'react';
import {
  type AccessibilityValue,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {HERO_PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {withAlpha} from './layout';

export interface AppProgressBarProps {
  /** How far along, 0 to 1. */
  value: number;
  /** "3/9" in a mint chip after the bar; left out when not given. */
  count?: string;
  /** Thinner bar for list rows and small cards. */
  compact?: boolean;
  /** On a white card: a beige track, so the white one does not vanish. */
  onCard?: boolean;
  /**
   * Makes the bar tappable: called with where it was tapped, from 0 up to
   * (not including) 1, so a screen can jump to that page or sentence.
   */
  onSeek?: (ratio: number) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityValue?: AccessibilityValue;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Put on the filled part, for tests that read its width. */
  fillTestID?: string;
}

/**
 * The app's one progress bar: a white track raised on a cream edge, the
 * covered part a mint bar with a darker shelf and a light streak on top.
 */
export function AppProgressBar({
  value,
  count,
  compact = false,
  onCard = false,
  onSeek,
  accessibilityLabel,
  accessibilityHint,
  accessibilityValue,
  style,
  testID,
  fillTestID,
}: AppProgressBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const width = useRef(0);
  const share = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;

  const track = (
    <View
      pointerEvents="none"
      style={[
        styles.track,
        compact ? styles.trackCompact : null,
        onCard ? styles.trackOnCard : null,
      ]}
    >
      {share > 0 ? (
        <View
          style={[
            styles.fill,
            compact ? styles.fillCompact : null,
            {width: `${share * 100}%`},
          ]}
          testID={fillTestID}
        >
          {compact ? null : <View style={styles.shine} />}
        </View>
      ) : null}
    </View>
  );

  const a11y = {
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole: 'progressbar' as const,
    accessibilityValue: accessibilityValue ?? {
      min: 0,
      max: 100,
      now: Math.round(share * 100),
    },
    testID,
  };

  return (
    <View style={[styles.row, style]}>
      {onSeek ? (
        <Pressable
          {...a11y}
          hitSlop={{top: 10, bottom: 10}}
          onLayout={(event: LayoutChangeEvent) => {
            width.current = event.nativeEvent.layout.width;
          }}
          onPress={(event: GestureResponderEvent) => {
            if (width.current <= 0) {
              return;
            }
            const ratio = event.nativeEvent.locationX / width.current;
            onSeek(Math.max(0, Math.min(ratio, 0.9999)));
          }}
          style={styles.bar}
        >
          {track}
        </Pressable>
      ) : (
        <View {...a11y} style={styles.bar}>
          {track}
        </View>
      )}
      {count !== undefined ? (
        <View style={styles.count}>
          <AppText
            style={styles.countText}
            testID={testID && `${testID}-label`}
          >
            {count}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    bar: {
      flex: 1,
      justifyContent: 'center',
    },
    track: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      height: 16,
      padding: 3,
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    trackCompact: {
      height: 10,
      padding: 2,
    },
    trackOnCard: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    fill: {
      backgroundColor: theme.colors.accent,
      borderBottomWidth: 3,
      borderColor: HERO_PALETTE.shelf,
      borderRadius: theme.radius.pill,
      height: '100%',
      minWidth: 10,
      overflow: 'hidden',
    },
    fillCompact: {
      borderBottomWidth: 2,
      minWidth: 6,
    },
    shine: {
      backgroundColor: withAlpha(HERO_PALETTE.white, 0.55),
      borderRadius: theme.radius.pill,
      height: 3,
      left: 4,
      position: 'absolute',
      right: 4,
      top: 1,
    },
    count: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
      ...getStickerEdge(2, withAlpha(theme.colors.primary, 0.14)),
    },
    countText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
  });
}
