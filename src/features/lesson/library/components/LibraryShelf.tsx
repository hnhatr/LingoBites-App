import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import type {GridTileTone} from '@ui/components/GridTile';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getHardShadow} from '@ui/theme/hardShadow';

/** What a shelf shows while it has no cards to list. */
export type ShelfStatus =
  | {kind: 'loading'}
  | {kind: 'message'; text: string; onRetry?: () => void};

export interface LibraryShelfProps {
  title: string;
  /** Opens the full list; hidden when omitted. */
  onSeeAll?: () => void;
  /** Shown in place of the cards (loading, empty, error). */
  status?: ShelfStatus | null;
  children?: React.ReactNode;
  testID?: string;
}

/** A titled row of cards that scrolls sideways, with a "Tất cả" link. */
export function LibraryShelf({
  title,
  onSeeAll,
  status,
  children,
  testID,
}: LibraryShelfProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.shelf} testID={testID}>
      <View style={styles.head}>
        <AppText style={styles.title}>{title}</AppText>
        {onSeeAll ? (
          <Pressable
            accessibilityHint={`Mở toàn bộ ${title}`}
            accessibilityLabel={`Tất cả ${title}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onSeeAll}
            testID={testID ? `${testID}-all` : undefined}
          >
            <AppText style={styles.seeAll}>Tất cả</AppText>
          </Pressable>
        ) : null}
      </View>
      {status?.kind === 'loading' ? (
        <ActivityIndicator
          color={theme.colors.primary}
          style={styles.loading}
          testID={testID ? `${testID}-loading` : undefined}
        />
      ) : status?.kind === 'message' ? (
        <View style={styles.message}>
          <AppText
            color="secondary"
            style={styles.messageText}
            testID={testID ? `${testID}-message` : undefined}
          >
            {status.text}
          </AppText>
          {status.onRetry ? (
            <Pressable
              accessibilityHint="Tải lại"
              accessibilityLabel="Thử lại"
              accessibilityRole="button"
              hitSlop={8}
              onPress={status.onRetry}
              testID={testID ? `${testID}-retry` : undefined}
            >
              <AppText style={styles.seeAll}>Thử lại</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.row}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

export interface ShelfCardProps {
  title: string;
  /** Icon drawn on the cover, unless `coverLabel` is given. */
  icon: HandoffIconName;
  /** Big text on the cover instead of the icon, e.g. a level "A1". */
  coverLabel?: string;
  /** Small line under the title, e.g. a duration. */
  meta?: string | null;
  tone?: GridTileTone;
  /** Round badge in the cover's corner, e.g. downloaded. */
  badge?: HandoffIconName;
  /** Learning progress, 0–1; no bar when omitted. */
  progress?: number;
  width?: number;
  onPress: () => void;
  accessibilityHint: string;
  testID?: string;
}

/** One card on a shelf: tinted cover, then title and a short meta line. */
export function ShelfCard({
  title,
  icon,
  coverLabel,
  meta,
  tone = 'accent',
  badge,
  progress,
  width = 128,
  onPress,
  accessibilityHint,
  testID,
}: ShelfCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {face, ink} = shelfTone(theme, tone);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={meta ? `${title}. ${meta}` : title}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [{width}, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={[styles.cover, {backgroundColor: face}]}>
        {coverLabel ? (
          <AppText style={[styles.coverLabel, {color: ink}]}>
            {coverLabel}
          </AppText>
        ) : (
          <MaterialIcon color={ink} name={icon} size={32} />
        )}
        {badge ? (
          <View style={styles.badge}>
            <MaterialIcon color={theme.colors.primary} name={badge} size={16} />
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={2} style={styles.cardTitle}>
        {title}
      </AppText>
      {meta ? (
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {meta}
        </AppText>
      ) : null}
      {progress !== undefined ? (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(
                  Math.min(Math.max(progress, 0), 1) * 100,
                )}%`,
              },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Cover face and ink for a tone, matching the Library's sticker tiles. */
export function shelfTone(theme: AppTheme, tone: GridTileTone) {
  const {colors} = theme;
  switch (tone) {
    case 'accent':
      return {
        face: solidOver(colors.accentSoft, colors.surface),
        ink: colors.primary,
      };
    case 'tertiary':
      return {
        face: solidOver(colors.tertiarySoft, colors.surface),
        ink: colors.onTertiaryContainer,
      };
    case 'secondary':
      return {
        face: solidOver(colors.secondarySoft, colors.surface),
        ink: colors.secondary,
      };
    default:
      return {
        face: solidOver(colors.surfaceContainer, colors.surface),
        ink: colors.text.primary,
      };
  }
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    shelf: {
      gap: theme.spacing.sm,
    },
    head: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.gutter,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
    },
    seeAll: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    row: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
      paddingHorizontal: theme.gutter,
    },
    loading: {
      paddingVertical: theme.spacing.xl,
    },
    message: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.md,
    },
    messageText: {
      flex: 1,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    cover: {
      alignItems: 'center',
      borderColor: theme.colors.ink,
      borderRadius: 16,
      borderWidth: 2,
      height: 84,
      justifyContent: 'center',
      marginBottom: theme.spacing.xs + 2,
      ...getHardShadow(3, theme.colors.ink),
    },
    coverLabel: {
      fontSize: 28,
      fontWeight: '800',
    },
    badge: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.ink,
      borderRadius: 12,
      borderWidth: 1.5,
      height: 24,
      justifyContent: 'center',
      position: 'absolute',
      right: 6,
      top: 6,
      width: 24,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 3,
      height: 6,
      marginTop: theme.spacing.xs,
      overflow: 'hidden',
    },
    fill: {
      backgroundColor: theme.colors.primary,
      height: '100%',
    },
  });
}
