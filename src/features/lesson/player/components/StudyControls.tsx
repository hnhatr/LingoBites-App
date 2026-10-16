/**
 * Shared pieces of the lesson's study screens (Học từng câu, Từ & cụm, Mẫu
 * câu, Nghe hiểu, Phát âm, Ngữ pháp): the page layout with its bottom
 * buttons, the progress strip and the bookmark toggle.
 */
import React, {useEffect, useMemo, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SaveToggle} from '@ui/components/SaveToggle';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge, getStickerFace} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

type StudyPageProps = {
  /** Changing it scrolls back to the top, e.g. the current sentence. */
  pageKey: string | number;
  children: React.ReactNode;
  footer: React.ReactNode;
  testID?: string;
};

/** A study page: its own scroll area over a fixed row of buttons. */
export function StudyPage({pageKey, children, footer, testID}: StudyPageProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo?.({y: 0, animated: false});
  }, [pageKey]);
  return (
    <View style={styles.page} testID={testID}>
      <ScrollView
        contentContainerStyle={styles.content}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.page}
      >
        {children}
      </ScrollView>
      <BottomActionBar style={styles.footer}>{footer}</BottomActionBar>
    </View>
  );
}

type NavButtonProps = {
  label: string;
  onPress: () => void;
  /** `ghost` for "back", `coral` for "next", `primary` for a main action. */
  tone: 'ghost' | 'coral' | 'primary';
  icon?: HandoffIconName;
  iconSide?: 'left' | 'right';
  disabled?: boolean;
  accessibilityHint?: string;
  testID: string;
};

/** One of the two buttons at the bottom of a study page. */
export function StudyNavButton({
  label,
  onPress,
  tone,
  icon,
  iconSide = 'left',
  disabled = false,
  accessibilityHint,
  testID,
}: NavButtonProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ink =
    tone === 'ghost'
      ? theme.colors.primary
      : tone === 'primary'
        ? theme.colors.text.inverse
        : (HERO_PALETTE.white as string);
  const iconNode = icon ? (
    <MaterialIcon color={ink} name={icon} size={20} />
  ) : null;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.navButton,
        tone === 'ghost'
          ? styles.navGhost
          : tone === 'coral'
            ? styles.navCoral
            : styles.navPrimary,
        pressed ? styles.navPressed : null,
        disabled ? styles.navDisabled : null,
      ]}
      testID={testID}
    >
      {iconSide === 'left' ? iconNode : null}
      <AppText numberOfLines={1} style={[styles.navText, {color: ink}]}>
        {label}
      </AppText>
      {iconSide === 'right' ? iconNode : null}
    </Pressable>
  );
}

/** The two bottom buttons side by side. */
export function StudyNavRow({children}: {children: React.ReactNode}) {
  return <View style={rowStyles.row}>{children}</View>;
}

type ProgressProps = {
  total: number;
  index: number;
  /** "3/9"; shown at the end of the strip. */
  label: string;
  onSelect: (index: number) => void;
  testID?: string;
};

/**
 * Segments for every page (done, current, still to come) with "3/9" after
 * them. Tapping a segment jumps there; screen readers use the page's own
 * next / previous actions instead.
 */
export function StudyProgress({
  total,
  index,
  label,
  onSelect,
  testID = 'study-progress',
}: ProgressProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.progress} testID={testID}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.segments}
      >
        {Array.from({length: total}, (_, k) => (
          <Pressable
            accessibilityRole="button"
            hitSlop={{top: 10, bottom: 10}}
            key={k}
            onPress={() => onSelect(k)}
            style={[
              styles.segment,
              k < index ? styles.segmentDone : null,
              k === index ? styles.segmentOn : null,
            ]}
            testID={`${testID}-${k}`}
          />
        ))}
      </View>
      <AppText style={styles.progressLabel} testID={`${testID}-label`}>
        {label}
      </AppText>
    </View>
  );
}

type BookmarkProps = {
  saved: boolean;
  onPress: () => void;
  /** Read aloud: "Lưu thẻ" / "Đánh dấu"; "Đã lưu" once saved. */
  label: string;
  savedLabel: string;
  accessibilityHint?: string;
  /** Lighter face on a tinted card. */
  onTint?: boolean;
  testID: string;
};

/** Square bookmark button: the shared save toggle on the square face. */
export function BookmarkToggle({
  saved,
  onPress,
  label,
  savedLabel,
  accessibilityHint,
  onTint = false,
  testID,
}: BookmarkProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <SaveToggle
      accessibilityHint={accessibilityHint ?? ''}
      accessibilityLabel={saved ? savedLabel : label}
      hitSlop={4}
      iconSize={19}
      onPress={onPress}
      saved={saved}
      size={40}
      style={[styles.square, onTint ? styles.squareOnTint : null]}
      testID={testID}
    />
  );
}

type SpeakSquareProps = {
  onPress: () => void;
  /** `timer` for "Nghe chậm". */
  icon?: HandoffIconName;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onTint?: boolean;
  testID: string;
};

/** Square "listen" button matching the bookmark toggle. */
export function SpeakSquare({
  onPress,
  icon = 'volume_up',
  accessibilityLabel,
  accessibilityHint,
  onTint = false,
  testID,
}: SpeakSquareProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({pressed}) => [
        styles.square,
        styles.speak,
        onTint ? styles.squareOnTint : null,
        pressed ? styles.navPressed : null,
      ]}
      testID={testID}
    >
      <MaterialIcon color={theme.colors.primary} name={icon} size={19} />
    </Pressable>
  );
}

/** Small uppercase label above a block, e.g. "MẸO", "TRONG BÀI". */
export function StudyLabel({
  children,
  color,
  testID,
}: {
  children: string;
  color?: string;
  testID?: string;
}) {
  const {theme} = useAppTheme();
  return (
    <AppText
      style={[rowStyles.label, {color: color ?? theme.colors.text.muted}]}
      testID={testID}
    >
      {children.toUpperCase()}
    </AppText>
  );
}

/** White sticker card used by every study page. */
export function studyCardStyle(theme: AppTheme) {
  return {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    ...getStickerFace(theme, 4),
  } as const;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    page: {
      flex: 1,
    },
    content: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    footer: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.outlineVariant,
    },
    navButton: {
      alignItems: 'center',
      borderRadius: theme.radius.lg,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 12,
    },
    navGhost: {
      backgroundColor: theme.colors.surface,
      ...getStickerEdge(4, theme.colors.outlineVariant),
    },
    navCoral: {
      backgroundColor: HERO_PALETTE.coral,
      ...getStickerEdge(4, HERO_PALETTE.coralShelf),
    },
    navPrimary: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(4, HERO_PALETTE.tealInk),
    },
    navPressed: {
      opacity: theme.states.pressedOpacity,
    },
    navDisabled: {
      opacity: theme.states.disabledOpacity,
    },
    navText: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '800',
    },
    progress: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    segments: {
      flex: 1,
      flexDirection: 'row',
      gap: 4,
    },
    segment: {
      backgroundColor: theme.colors.outlineVariant,
      borderRadius: 4,
      flex: 1,
      height: 8,
    },
    segmentDone: {
      backgroundColor: theme.colors.accent,
    },
    segmentOn: {
      backgroundColor: HERO_PALETTE.coral,
    },
    progressLabel: {
      color: theme.colors.text.muted,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    square: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 12,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    squareOnTint: {
      backgroundColor: theme.colors.surface,
    },
    speak: {
      backgroundColor: theme.colors.secondarySoft,
    },
  });
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
});
