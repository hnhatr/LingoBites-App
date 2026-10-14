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
import {
  LibraryCover,
  type LibraryCoverProps,
} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerFace, isStickerTheme} from '@ui/theme/hardShadow';
import {levelTone} from '@ui/theme/levelColors';

const CARD_RADIUS = 18;

/** What a shelf shows while it has no cards to list. */
export type ShelfStatus =
  {kind: 'loading'} | {kind: 'message'; text: string; onRetry?: () => void};

export interface LibraryShelfProps {
  title: string;
  /** Icon before the title. */
  icon?: HandoffIconName;
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
  icon,
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
        <View style={styles.titleRow}>
          {icon ? (
            <MaterialIcon color={theme.colors.primary} name={icon} size={20} />
          ) : null}
          <AppText style={styles.title}>{title}</AppText>
        </View>
        {onSeeAll ? (
          <Pressable
            accessibilityHint={`Mở toàn bộ ${title}`}
            accessibilityLabel={`Tất cả ${title}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onSeeAll}
            style={styles.seeAllRow}
            testID={testID ? `${testID}-all` : undefined}
          >
            <AppText style={styles.seeAll}>Tất cả</AppText>
            <MaterialIcon
              color={theme.colors.primary}
              name="chevron_right"
              size={18}
            />
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
  /** Lines the title may take; packs keep to one, under their sub line. */
  titleLines?: 1 | 2;
  /** Quiet line under the title, e.g. "Gói 1 · 12 từ". */
  sub?: string | null;
  /** Meta line with an icon, e.g. a duration or a lesson count. */
  meta?: string | null;
  metaIcon?: HandoffIconName;
  /** The cover picture with its level chip and badges. */
  cover: LibraryCoverProps;
  /** Learning progress, 0–1; no bar when omitted. */
  progress?: number;
  width: number;
  onPress: () => void;
  accessibilityHint: string;
  testID?: string;
}

/**
 * One card on a shelf: the cover on top, then the title, a quiet sub line,
 * a meta line and the progress bar, all inside one outlined card. Titles
 * keep a fixed number of lines so the cards of a row stay the same height.
 */
export function ShelfCard({
  title,
  titleLines = 2,
  sub,
  meta,
  metaIcon,
  cover,
  progress,
  width,
  onPress,
  accessibilityHint,
  testID,
}: ShelfCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tone = levelTone(theme, cover.level);
  const label = [cover.level, title, sub, meta].filter(Boolean).join('. ');

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.card, {width}, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.clip}>
        <LibraryCover
          {...cover}
          testID={testID ? `${testID}-cover` : undefined}
        />
        <View style={styles.body}>
          <AppText
            numberOfLines={titleLines}
            style={[
              styles.cardTitle,
              {minHeight: styles.cardTitle.lineHeight * titleLines},
            ]}
          >
            {title}
          </AppText>
          {sub ? (
            <AppText color="secondary" numberOfLines={1} variant="caption">
              {sub}
            </AppText>
          ) : null}
          {progress !== undefined ? (
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: tone.strong,
                    width: `${Math.round(
                      Math.min(Math.max(progress, 0), 1) * 100,
                    )}%`,
                  },
                ]}
              />
            </View>
          ) : null}
          {meta ? (
            <View style={styles.meta}>
              {metaIcon ? (
                <MaterialIcon
                  color={theme.colors.text.secondary}
                  name={metaIcon}
                  size={14}
                />
              ) : null}
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {meta}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
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
    titleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs + 2,
    },
    seeAllRow: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: CARD_RADIUS,
      ...(getStickerFace(theme, 3, 2) ?? {
        borderColor: theme.colors.outlineVariant,
        borderWidth: 1,
      }),
    },
    clip: {
      borderRadius: CARD_RADIUS - 2,
      overflow: 'hidden',
    },
    body: {
      borderColor: theme.colors.ink,
      borderTopWidth: isStickerTheme(theme) ? 2 : 0,
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm + 2,
      paddingTop: theme.spacing.sm,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 19,
    },
    meta: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 4,
      height: 7,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
    },
  });
}
