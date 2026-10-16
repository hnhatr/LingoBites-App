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

/** Above this many items, several items share one note. */
export const MAX_PROGRESS_NOTES = 20;

export interface AppProgressBarProps {
  /** How many items (cards, sentences, steps) the bar stands for. */
  total: number;
  /** The open item, 0-based: its note is coral. Leave out for a plain tally. */
  current?: number;
  /**
   * Finished items: a count (the first n) or the set of finished indexes.
   * Defaults to every item before `current`.
   */
  done?: number | ReadonlySet<number>;
  /** Items with nothing to do: drawn faded. */
  skipped?: ReadonlySet<number>;
  /** "3/9" in a mint chip after the bar; left out when not given. */
  count?: string;
  /** Thinner notes for list rows and small cards. */
  compact?: boolean;
  /**
   * What the bar sits on, which sets the upcoming notes: white on the page,
   * beige on a white `card` so they do not vanish, pale mint on a `hero`
   * card (fixed colours, the same in every theme).
   */
  surface?: 'page' | 'card' | 'hero';
  /** Makes the bar tappable: called with the first item of the tapped note. */
  onSelect?: (index: number) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityValue?: AccessibilityValue;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

type NoteState = 'done' | 'current' | 'upcoming';

/**
 * The app's one progress bar: a row of notes, one per item. Finished notes
 * are mint on a darker shelf with a light streak, the open one coral with a
 * soft ring, the rest white raised on a cream edge. Long lists group several
 * items into a note so there are never more than {@link MAX_PROGRESS_NOTES}.
 */
export function AppProgressBar({
  total,
  current,
  done,
  skipped,
  count,
  compact = false,
  surface = 'page',
  onSelect,
  accessibilityLabel,
  accessibilityHint,
  accessibilityValue,
  style,
  testID,
}: AppProgressBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const width = useRef(0);
  const items = Math.max(0, Math.floor(total));
  const perNote =
    items > MAX_PROGRESS_NOTES ? Math.ceil(items / MAX_PROGRESS_NOTES) : 1;
  const noteCount = Math.ceil(items / perNote);

  const isDone = (index: number) => {
    if (done === undefined) {
      return current !== undefined && index < current;
    }
    return typeof done === 'number' ? index < done : done.has(index);
  };

  const notes = Array.from({length: noteCount}, (_, note) => {
    const first = note * perNote;
    const last = Math.min(items, first + perNote) - 1;
    let state: NoteState = 'upcoming';
    if (current !== undefined && current >= first && current <= last) {
      state = 'current';
    } else {
      let allDone = true;
      for (let k = first; k <= last; k += 1) {
        allDone = allDone && isDone(k);
      }
      state = allDone ? 'done' : 'upcoming';
    }
    const faded = state !== 'current' && (skipped?.has(first) ?? false);
    return (
      <View key={note} style={styles.slot}>
        {state === 'current' ? <View style={styles.ring} /> : null}
        <View
          style={[
            styles.note,
            compact ? styles.noteCompact : null,
            state === 'upcoming'
              ? [
                  styles.upcoming,
                  surface === 'card' ? styles.upcomingOnCard : null,
                  surface === 'hero' ? styles.upcomingOnHero : null,
                ]
              : null,
            state === 'done' || faded
              ? [styles.done, compact ? styles.shelfCompact : null]
              : null,
            state === 'current'
              ? [styles.current, compact ? styles.shelfCompact : null]
              : null,
            faded ? styles.faded : null,
          ]}
        >
          {!compact && state !== 'upcoming' ? (
            <View style={styles.shine} />
          ) : null}
        </View>
      </View>
    );
  });

  const row = (
    <View
      pointerEvents="none"
      style={[styles.notes, compact ? styles.notesCompact : null]}
    >
      {notes}
    </View>
  );

  const a11y = {
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole: 'progressbar' as const,
    accessibilityValue: accessibilityValue ?? {
      min: 0,
      max: items,
      now: current !== undefined ? current + 1 : countDone(done, items),
    },
    testID,
  };

  return (
    <View style={[styles.row, style]}>
      {onSelect ? (
        <Pressable
          {...a11y}
          hitSlop={{top: 10, bottom: 10}}
          onLayout={(event: LayoutChangeEvent) => {
            width.current = event.nativeEvent.layout.width;
          }}
          onPress={(event: GestureResponderEvent) => {
            if (width.current <= 0 || noteCount === 0) {
              return;
            }
            const ratio = event.nativeEvent.locationX / width.current;
            const note = Math.floor(
              Math.max(0, Math.min(ratio, 0.9999)) * noteCount,
            );
            onSelect(Math.min(items - 1, note * perNote));
          }}
          style={styles.bar}
        >
          {row}
        </Pressable>
      ) : (
        <View {...a11y} style={styles.bar}>
          {row}
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

function countDone(
  done: number | ReadonlySet<number> | undefined,
  items: number,
): number {
  if (done === undefined) {
    return 0;
  }
  return typeof done === 'number' ? Math.min(done, items) : done.size;
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
      minHeight: 20,
    },
    notes: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    notesCompact: {
      gap: 3,
    },
    slot: {
      flex: 1,
      justifyContent: 'center',
    },
    ring: {
      backgroundColor: HERO_PALETTE.coralRing,
      borderRadius: theme.radius.pill,
      bottom: -3,
      left: -3,
      position: 'absolute',
      right: -3,
      top: -3,
    },
    note: {
      borderRadius: theme.radius.pill,
      height: 12,
      overflow: 'hidden',
    },
    noteCompact: {
      height: 8,
    },
    upcoming: {
      backgroundColor: theme.colors.surface,
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    upcomingOnCard: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    upcomingOnHero: {
      backgroundColor: HERO_PALETTE.track,
      ...getStickerEdge(2, HERO_PALETTE.ghostShelf),
    },
    done: {
      backgroundColor: theme.colors.accent,
      borderBottomWidth: 3,
      borderColor: HERO_PALETTE.shelf,
    },
    current: {
      backgroundColor: HERO_PALETTE.coral,
      borderBottomWidth: 3,
      borderColor: HERO_PALETTE.coralShelf,
    },
    shelfCompact: {
      borderBottomWidth: 2,
    },
    faded: {
      opacity: 0.45,
    },
    shine: {
      backgroundColor: withAlpha(HERO_PALETTE.white, 0.55),
      borderRadius: theme.radius.pill,
      height: 2,
      left: 3,
      position: 'absolute',
      right: 3,
      top: 2,
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
