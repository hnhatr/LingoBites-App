import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {LibraryTone} from '../logic/librarySections';
import {libraryTone} from './libraryTones';

/** What a shelf shows while it has no cards to list. */
export type ShelfStatus =
  {kind: 'loading'} | {kind: 'message'; text: string; onRetry?: () => void};

export interface LibraryShelfProps {
  /** Section heading, e.g. "Gói từ vựng". */
  title: string;
  /** What the section holds, for the full-list hint, e.g. "gói học". */
  label: string;
  tone: LibraryTone;
  /** Quiet line under the title. */
  subtitle?: string;
  /** Item count shown in the full-list link, e.g. "24" or "20+". */
  count?: string | null;
  /** Opens the full list; hidden when omitted. */
  onSeeAll?: () => void;
  /** Spoken name of the full-list link, e.g. "Xem cả 24 gói". */
  seeAllLabel?: string;
  /** Shown in place of the items (loading, empty, error). */
  status?: ShelfStatus | null;
  children?: React.ReactNode;
  testID?: string;
}

/**
 * One Library section on the page background, like the Courses tab: a
 * heading with its subtitle, a "Tất cả" link with the count beside it,
 * then the cards stacked down the page.
 */
export function LibraryShelf({
  title,
  label,
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
    <View style={styles.shelf} testID={testID}>
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
        {onSeeAll && !status ? (
          <Pressable
            accessibilityHint={`Mở toàn bộ ${label}`}
            accessibilityLabel={seeAllLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onSeeAll}
            style={({pressed}) => [styles.seeAll, pressed && styles.pressed]}
            testID={testID ? `${testID}-all` : undefined}
          >
            <AppText style={styles.seeAllText}>Tất cả</AppText>
            {count ? (
              <AppText
                style={styles.seeAllText}
                testID={testID ? `${testID}-count` : undefined}
              >
                {count}
              </AppText>
            ) : null}
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
    </View>
  );
}

/**
 * The sticker face of Library cards: a hard ink shadow and no outline, in
 * every theme, so the folders and cards keep the Library's paper look.
 * Android cannot draw an unblurred shadow (elevation always blurs), so
 * there the same ink edge is a thick bottom border instead.
 */
export function stickerCard(theme: AppTheme, offset = 3): ViewStyle {
  return getStickerEdge(offset, theme.colors.ink);
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    shelf: {
      gap: 14,
    },
    head: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    headText: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.3,
      lineHeight: 30,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '600',
    },
    seeAll: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 3,
      minHeight: 44,
      paddingLeft: theme.spacing.md,
    },
    seeAllText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '700',
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
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
  });
}
