import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import type {GridTileTone} from '@ui/components/GridTile';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {LibraryTone} from '../logic/librarySections';
import {libraryTone} from './libraryTones';

/** What a shelf shows while it has no cards to list. */
export type ShelfStatus =
  {kind: 'loading'} | {kind: 'message'; text: string; onRetry?: () => void};

export interface LibraryShelfProps {
  /** Big heading inside the folder, e.g. "Gói từ vựng". */
  title: string;
  /** Short name on the folder's tab, e.g. "Gói học". */
  label: string;
  /** Icon on the folder's tab. */
  icon: HandoffIconName;
  tone: LibraryTone;
  /** Quiet line under the title. */
  subtitle?: string;
  /** Big number beside the title, e.g. "24" or "20+"; hidden when null. */
  count?: string | null;
  /** Opens the full list; hidden when omitted. */
  onSeeAll?: () => void;
  /** Text of the full-list button, e.g. "Xem cả 24 gói". */
  seeAllLabel?: string;
  /** Shown in place of the items (loading, empty, error). */
  status?: ShelfStatus | null;
  children?: React.ReactNode;
  testID?: string;
}

/**
 * One Library section as a coloured folder: a tab with its name on top,
 * then a big title with the item count, the items stacked down the page,
 * and a button to the full list.
 */
export function LibraryShelf({
  title,
  label,
  icon,
  tone,
  subtitle,
  count,
  onSeeAll,
  seeAllLabel = 'Xem tất cả',
  status,
  children,
  testID,
}: LibraryShelfProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const colors = libraryTone(theme, tone);

  return (
    <View testID={testID}>
      <View style={[styles.tab, {backgroundColor: colors.soft}]}>
        <MaterialIcon color={colors.ink} name={icon} size={15} />
        <AppText style={[styles.tabText, {color: colors.ink}]}>
          {label.toUpperCase()}
        </AppText>
      </View>
      <View style={[styles.folder, {backgroundColor: colors.soft}]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <AppText accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText color="secondary" style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {count ? (
            <AppText
              style={[styles.count, {color: colors.strong}]}
              testID={testID ? `${testID}-count` : undefined}
            >
              {count}
            </AppText>
          ) : null}
        </View>
        {status?.kind === 'loading' ? (
          <ActivityIndicator
            color={colors.ink}
            style={styles.loading}
            testID={testID ? `${testID}-loading` : undefined}
          />
        ) : status?.kind === 'message' ? (
          <View style={[styles.message, {borderColor: colors.strong}]}>
            <AppText
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
                style={({pressed}) => [styles.retry, pressed && styles.pressed]}
                testID={testID ? `${testID}-retry` : undefined}
              >
                <MaterialIcon
                  color={theme.colors.text.inverse}
                  name="refresh"
                  size={16}
                />
                <AppText style={styles.retryText}>Thử lại</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          children
        )}
        {onSeeAll && !status ? (
          <Pressable
            accessibilityHint={`Mở toàn bộ ${label}`}
            accessibilityLabel={seeAllLabel}
            accessibilityRole="button"
            onPress={onSeeAll}
            style={({pressed}) => [
              styles.seeAll,
              pressed && styles.pressedDown,
            ]}
            testID={testID ? `${testID}-all` : undefined}
          >
            <AppText style={[styles.seeAllText, {color: colors.ink}]}>
              {seeAllLabel}
            </AppText>
            <MaterialIcon color={colors.ink} name="chevron_right" size={18} />
          </Pressable>
        ) : null}
      </View>
    </View>
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

/** The sticker face of Library cards: a hard ink shadow, else a hairline. */
export function stickerCard(theme: AppTheme, offset = 3) {
  return (
    getStickerFace(theme, offset) ?? {
      borderColor: theme.colors.outlineVariant,
      borderWidth: 1,
    }
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    tab: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      flexDirection: 'row',
      gap: 6,
      height: 28,
      paddingLeft: 12,
      paddingRight: 16,
    },
    tabText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
    },
    folder: {
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
      borderTopRightRadius: 22,
      gap: theme.spacing.md,
      padding: 14,
      paddingTop: 18,
      ...stickerCard(theme, 4),
    },
    head: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    headText: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.6,
      lineHeight: 30,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '600',
    },
    count: {
      fontSize: 46,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
      letterSpacing: -1.5,
      lineHeight: 48,
      opacity: 0.85,
    },
    loading: {
      paddingVertical: theme.spacing.xl,
    },
    message: {
      alignItems: 'center',
      borderRadius: 16,
      borderStyle: 'dashed',
      borderWidth: 2,
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: 14,
    },
    messageText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
    },
    retry: {
      alignItems: 'center',
      backgroundColor: theme.colors.text.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 4,
      height: 34,
      paddingHorizontal: 12,
    },
    retryText: {
      color: theme.colors.text.inverse,
      fontSize: 13,
      fontWeight: '800',
    },
    seeAll: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 4,
      height: 46,
      justifyContent: 'center',
      ...stickerCard(theme),
    },
    seeAllText: {
      fontSize: 14,
      fontWeight: '800',
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    pressedDown: {
      transform: [{translateY: 2}],
    },
  });
}
