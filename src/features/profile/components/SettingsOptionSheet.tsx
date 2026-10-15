import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

export type SettingsOptionTone = 'teal' | 'gold' | 'coral' | 'muted';

export type SettingsOption = {
  key: string;
  label: string;
  caption?: string;
  /** A large number in the leading tile, e.g. a weekly goal. */
  badge?: string;
  /** An icon in the leading tile (ignored when `badge` is set). */
  icon?: HandoffIconName;
  tone?: SettingsOptionTone;
  /** Draws a row of `total` cells with the first `filled` lit. */
  meter?: {filled: number; total: number};
};

export type SettingsOptionSheetProps = {
  title: string;
  subtitle?: string;
  options: readonly SettingsOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onDismiss: () => void;
  testID?: string;
};

/** Bottom sheet with a single-choice list for a Profile setting (F6). */
export function SettingsOptionSheet({
  title,
  subtitle,
  options,
  selectedKey,
  onSelect,
  onDismiss,
  testID,
}: SettingsOptionSheetProps) {
  return (
    <SettingsSheetFrame
      onDismiss={onDismiss}
      subtitle={subtitle}
      testID={testID}
      title={title}
    >
      {options.map(option => (
        <SettingsOptionCard
          key={option.key}
          onPress={() => onSelect(option.key)}
          option={option}
          selected={option.key === selectedKey}
        />
      ))}
    </SettingsSheetFrame>
  );
}

type FrameProps = {
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  testID?: string;
  children: React.ReactNode;
};

/** The sheet itself: grab handle, title, close button, then the content. */
export function SettingsSheetFrame({
  title,
  subtitle,
  onDismiss,
  testID,
  children,
}: FrameProps) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);

  return (
    <Modal animationType="slide" onRequestClose={onDismiss} transparent visible>
      <Pressable
        accessibilityHint="Đóng bảng chọn"
        accessibilityLabel="Đóng"
        onPress={onDismiss}
        style={themedStyles.backdrop}
      />
      <View style={themedStyles.sheet} testID={testID}>
        <View style={themedStyles.grab} />
        <View style={themedStyles.head}>
          <View style={styles.headCopy}>
            <AppText style={themedStyles.title}>{title}</AppText>
            {subtitle ? (
              <AppText color="muted" style={themedStyles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <HeaderIconButton
            accessibilityHint="Đóng bảng chọn"
            accessibilityLabel="Đóng"
            icon="close"
            onPress={onDismiss}
          />
        </View>
        <View style={themedStyles.body}>{children}</View>
      </View>
    </Modal>
  );
}

type CardProps = {
  option: SettingsOption;
  selected: boolean;
  onPress: () => void;
  /** Shown under the row while it is selected, e.g. a time picker. */
  expanded?: React.ReactNode;
};

/** One choice of a settings sheet: a sticker card with a radio on the right. */
export function SettingsOptionCard({
  option,
  selected,
  onPress,
  expanded,
}: CardProps) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const tone = toneColors(theme, option.tone ?? 'teal');

  return (
    <View
      style={[
        themedStyles.card,
        selected ? themedStyles.cardOn : themedStyles.cardOff,
      ]}
    >
      <Pressable
        accessibilityHint={option.caption ?? 'Chạm để chọn'}
        accessibilityLabel={option.label}
        accessibilityRole="radio"
        accessibilityState={{selected}}
        onPress={onPress}
        style={({pressed}) => [
          themedStyles.option,
          pressed && themedStyles.pressed,
        ]}
      >
        {option.badge ? (
          <View
            style={[
              themedStyles.leading,
              selected ? themedStyles.badgeOn : themedStyles.badgeOff,
            ]}
          >
            <AppText
              style={[
                themedStyles.badge,
                selected && {color: HERO_PALETTE.tealInk},
              ]}
            >
              {option.badge}
            </AppText>
          </View>
        ) : option.icon ? (
          <View style={[themedStyles.leading, {backgroundColor: tone.bg}]}>
            <MaterialIcon color={tone.fg} name={option.icon} size={20} />
          </View>
        ) : null}
        <View style={styles.optionCopy}>
          <AppText style={themedStyles.label}>{option.label}</AppText>
          {option.caption ? (
            <AppText color="muted" style={themedStyles.caption}>
              {option.caption}
            </AppText>
          ) : null}
          {option.meter ? (
            <View style={themedStyles.meter}>
              {Array.from({length: option.meter.total}, (_, index) => (
                <View
                  key={index}
                  style={[
                    themedStyles.meterCell,
                    index < option.meter!.filled
                      ? themedStyles.meterOn
                      : selected
                        ? themedStyles.meterOffSelected
                        : themedStyles.meterOff,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
        {selected ? (
          <MaterialIcon
            color={theme.colors.primary}
            name="check_circle"
            size={26}
          />
        ) : (
          <View style={themedStyles.radio} />
        )}
      </Pressable>
      {selected && expanded ? expanded : null}
    </View>
  );
}

function toneColors(theme: AppTheme, tone: SettingsOptionTone) {
  switch (tone) {
    case 'gold':
      return {bg: theme.colors.tertiarySoft, fg: theme.colors.tertiary};
    case 'coral':
      return {bg: theme.colors.secondarySoft, fg: theme.colors.secondary};
    case 'muted':
      return {bg: theme.colors.surfaceMuted, fg: theme.colors.text.muted};
    default:
      return {bg: theme.colors.accentSoft, fg: theme.colors.primary};
  }
}

const styles = StyleSheet.create({
  headCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primaryContainer, 0.45);
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      marginTop: 'auto',
      paddingBottom: theme.spacing.xl,
    },
    grab: {
      alignSelf: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 3,
      height: 5,
      marginBottom: 4,
      marginTop: 10,
      width: 42,
    },
    head: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: 6,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    body: {
      gap: 10,
      paddingHorizontal: theme.gutter,
    },
    card: {
      borderRadius: 20,
      borderWidth: 2,
      overflow: 'hidden',
    },
    cardOff: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surface,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    cardOn: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.primaryContainer,
      ...getStickerEdge(3, mintEdge),
    },
    option: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 60,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    leading: {
      alignItems: 'center',
      borderRadius: 14,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    badgeOff: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    badgeOn: {
      backgroundColor: theme.colors.primaryContainer,
    },
    badge: {
      color: theme.colors.primary,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    label: {
      fontSize: 15.5,
      fontWeight: '800',
    },
    caption: {
      fontSize: 12.5,
      fontWeight: '600',
    },
    meter: {
      flexDirection: 'row',
      gap: 5,
      marginTop: 6,
    },
    meterCell: {
      borderRadius: 4,
      flex: 1,
      height: 7,
    },
    meterOn: {
      backgroundColor: theme.colors.primaryContainer,
    },
    meterOff: {
      backgroundColor: theme.colors.surfaceHigh,
    },
    meterOffSelected: {
      backgroundColor: theme.colors.surface,
    },
    radio: {
      borderColor: theme.colors.outlineVariant,
      borderRadius: 12,
      borderWidth: 2,
      height: 24,
      marginHorizontal: 1,
      width: 24,
    },
  });
}
