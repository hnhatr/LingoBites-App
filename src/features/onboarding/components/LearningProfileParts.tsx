import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

export type SectionTone = 'teal' | 'gold' | 'coral';

function toneColors(theme: AppTheme, tone: SectionTone) {
  switch (tone) {
    case 'gold':
      return {bg: theme.colors.tertiarySoft, fg: theme.colors.tertiary};
    case 'coral':
      return {bg: theme.colors.secondarySoft, fg: theme.colors.secondary};
    default:
      return {bg: theme.colors.accentSoft, fg: theme.colors.primary};
  }
}

type SectionCardProps = {
  icon: HandoffIconName;
  tone: SectionTone;
  title: string;
  hint?: string;
  /** A small count on the right, e.g. "1/3". */
  count?: {label: string; full: boolean};
  children: React.ReactNode;
  testID?: string;
};

/** One question of the learning profile: a white sticker card with a header. */
export function SectionCard({
  icon,
  tone,
  title,
  hint,
  count,
  children,
  testID,
}: SectionCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const colors = toneColors(theme, tone);
  return (
    <AppCard testID={testID}>
      <View style={styles.section}>
        <View style={styles.head}>
          <View style={[styles.medallion, {backgroundColor: colors.bg}]}>
            <MaterialIcon color={colors.fg} name={icon} size={18} />
          </View>
          <View style={styles.headCopy}>
            <AppText style={styles.title}>{title}</AppText>
            {hint ? (
              <AppText color="muted" style={styles.hint}>
                {hint}
              </AppText>
            ) : null}
          </View>
          {count ? (
            <View style={[styles.count, count.full && styles.countFull]}>
              <AppText
                style={[styles.countLabel, count.full && styles.countFullLabel]}
              >
                {count.label}
              </AppText>
            </View>
          ) : null}
        </View>
        {children}
      </View>
    </AppCard>
  );
}

type LevelTileProps = {
  code: string;
  name: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/** A large level choice: the CEFR code, its name and what it covers. */
export function LevelTile({
  code,
  name,
  description,
  selected,
  onPress,
  testID,
}: LevelTileProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint="Chạm để chọn trình độ này"
      accessibilityLabel={`${code} – ${name}`}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.tile,
        selected ? styles.tileOn : styles.tileOff,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {selected ? (
        <View style={styles.tick}>
          <MaterialIcon
            color={theme.colors.primary}
            name="check_circle"
            size={22}
          />
        </View>
      ) : null}
      <AppText style={styles.code}>{code}</AppText>
      <AppText style={styles.tileName}>{name}</AppText>
      <AppText color="muted" style={styles.tileDescription}>
        {description}
      </AppText>
    </Pressable>
  );
}

type RowLinkProps = {
  icon: HandoffIconName;
  title: string;
  caption: string;
  onPress: () => void;
  testID?: string;
};

/** A quiet dashed row inside a card, e.g. "Làm lại bài kiểm tra". */
export function RowLink({icon, title, caption, onPress, testID}: RowLinkProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint={caption}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.rowLink, pressed && styles.pressedSoft]}
      testID={testID}
    >
      <MaterialIcon color={theme.colors.primary} name={icon} size={18} />
      <View style={styles.headCopy}>
        <AppText style={styles.rowLinkTitle}>{title}</AppText>
        <AppText color="muted" style={styles.hint}>
          {caption}
        </AppText>
      </View>
      <MaterialIcon
        color={theme.colors.primary}
        name="chevron_right"
        size={20}
      />
    </Pressable>
  );
}

type IconChipProps = {
  icon: HandoffIconName;
  label: string;
  selected: boolean;
  dimmed?: boolean;
  onPress: () => void;
  testID?: string;
};

/** A choice chip with an icon; selected turns deep teal with a tick. */
export function IconChip({
  icon,
  label,
  selected,
  dimmed = false,
  onPress,
  testID,
}: IconChipProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint="Chạm để chọn"
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{selected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.chip,
        selected ? styles.chipOn : styles.chipOff,
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <MaterialIcon
        color={selected ? HERO_PALETTE.white : theme.colors.primary}
        name={selected ? 'check_circle' : icon}
        size={17}
      />
      <AppText style={[styles.chipLabel, selected && styles.chipLabelOn]}>
        {label}
      </AppText>
    </Pressable>
  );
}

type NumberTilesProps = {
  values: readonly number[];
  unit: string;
  selected: number;
  onSelect: (value: number) => void;
  testID?: string;
};

/** Equal tiles with a large number each, e.g. 5 / 10 / 15 / 20 phút. */
export function NumberTiles({
  values,
  unit,
  selected,
  onSelect,
  testID,
}: NumberTilesProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.numberRow}>
      {values.map(value => {
        const on = value === selected;
        return (
          <Pressable
            accessibilityHint="Chạm để chọn"
            accessibilityLabel={`${value} ${unit}`}
            accessibilityRole="radio"
            accessibilityState={{selected: on}}
            key={value}
            onPress={() => onSelect(value)}
            style={({pressed}) => [
              styles.numberTile,
              on ? styles.numberTileOn : styles.tileOff,
              pressed && styles.pressed,
            ]}
            testID={testID ? `${testID}-${value}` : undefined}
          >
            <AppText style={[styles.number, on && styles.numberOn]}>
              {value}
            </AppText>
            <AppText style={[styles.unit, on && styles.numberOn]}>
              {unit}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primaryContainer, 0.45);
  return StyleSheet.create({
    section: {
      gap: theme.spacing.md,
    },
    head: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    medallion: {
      alignItems: 'center',
      borderRadius: 12,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    headCopy: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
    },
    hint: {
      fontSize: 12.5,
      fontWeight: '600',
    },
    count: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 9,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    countFull: {
      backgroundColor: theme.colors.tertiarySoft,
    },
    countLabel: {
      color: theme.colors.text.secondary,
      fontSize: 12.5,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    countFullLabel: {
      color: theme.colors.onTertiaryContainer,
    },
    tile: {
      borderRadius: 18,
      borderWidth: 2,
      flex: 1,
      gap: 4,
      minWidth: 0,
      padding: 12,
    },
    tileOff: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.surfaceMuted,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    tileOn: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.primaryContainer,
      ...getStickerEdge(3, mintEdge),
    },
    tick: {
      position: 'absolute',
      right: 10,
      top: 10,
    },
    code: {
      color: theme.colors.primary,
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 28,
    },
    tileName: {
      fontSize: 14.5,
      fontWeight: '800',
    },
    tileDescription: {
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 17,
    },
    rowLink: {
      alignItems: 'center',
      borderColor: mintEdge,
      borderRadius: 16,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    rowLinkTitle: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    chip: {
      alignItems: 'center',
      borderRadius: 13,
      flexDirection: 'row',
      gap: 6,
      minHeight: 40,
      paddingLeft: 10,
      paddingRight: 13,
    },
    chipOff: {
      backgroundColor: theme.colors.surfaceMuted,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    chipOn: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(3, theme.colors.primaryPressed),
    },
    chipLabel: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      fontWeight: '700',
    },
    chipLabelOn: {
      color: HERO_PALETTE.white,
    },
    dimmed: {
      opacity: 0.4,
    },
    numberRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    numberTile: {
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 2,
      flex: 1,
      paddingBottom: 9,
      paddingTop: 10,
    },
    numberTileOn: {
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.primaryContainer,
      ...getStickerEdge(3, HERO_PALETTE.shelf),
    },
    number: {
      fontSize: 20,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    unit: {
      color: theme.colors.text.muted,
      fontSize: 11.5,
      fontWeight: '700',
    },
    numberOn: {
      color: HERO_PALETTE.tealInk,
    },
    pressed: {
      transform: [{translateY: 2}],
    },
    pressedSoft: {
      opacity: theme.states.pressedOpacity,
    },
  });
}
