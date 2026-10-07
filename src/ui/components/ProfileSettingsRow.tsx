import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {useAppTheme} from '../theme';
import {solidOver} from '../theme/colorUtils';
import {getStickerFace} from '../theme/hardShadow';
import {AppText} from './AppText';
import {Chip, type ChipTone} from './Chip';
import {MaterialIcon} from './MaterialIcon';
import {SettingsGroupContext} from './SettingsGroup';

type MedallionTone = 'teal' | 'coral' | 'gold';

type Props = {
  icon: HandoffIconName;
  label: string;
  medallionTone?: MedallionTone;
  trailing?: 'chevron' | {text: string} | {chip: string; chipTone?: ChipTone};
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

function medallionColors(
  theme: ReturnType<typeof useAppTheme>['theme'],
  tone: MedallionTone,
) {
  switch (tone) {
    case 'coral':
      return {bg: theme.colors.secondarySoft, fg: theme.colors.secondary};
    case 'gold':
      return {bg: theme.colors.tertiarySoft, fg: theme.colors.tertiary};
    default:
      return {bg: theme.colors.accentSoft, fg: theme.colors.primary};
  }
}

import {ShelfSurface} from './ShelfSurface';

export function ProfileSettingsRow({
  icon,
  label,
  medallionTone = 'teal',
  trailing,
  onPress,
  destructive = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const {theme} = useAppTheme();
  const grouped = React.useContext(SettingsGroupContext);
  const medallion = destructive
    ? {bg: theme.colors.secondarySoft, fg: theme.colors.danger}
    : medallionColors(theme, medallionTone);
  const shelf = theme.shelf?.surface;
  const stickerFace = getStickerFace(theme, 3);
  const rowRadius = stickerFace ? 20 : 22;
  const rowShadow = stickerFace ? undefined : theme.shadow.soft;

  const trailingNode = (() => {
    if (trailing === 'chevron') {
      return onPress ? (
        <MaterialIcon
          color={theme.colors.text.secondary}
          name="chevron_right"
          size={22}
        />
      ) : null;
    }
    if (trailing && 'chip' in trailing) {
      return (
        <Chip label={trailing.chip} tone={trailing.chipTone ?? 'accentSoft'} />
      );
    }
    if (trailing && 'text' in trailing) {
      return (
        <AppText color="muted" variant="caption">
          {trailing.text}
        </AppText>
      );
    }
    return null;
  })();

  const rowContent = (
    <>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: stickerFace
            ? solidOver(medallion.bg, theme.colors.surface)
            : medallion.bg,
          borderRadius: stickerFace ? 14 : 999,
          ...(stickerFace
            ? {borderColor: theme.colors.ink, borderWidth: 2}
            : null),
          height: 42,
          justifyContent: 'center',
          width: 42,
        }}
      >
        <MaterialIcon color={medallion.fg} name={icon} size={22} />
      </View>
      <AppText color={destructive ? 'danger' : undefined} style={styles.label}>
        {label}
      </AppText>
      {trailingNode}
    </>
  );

  if (grouped) {
    const flatContent = (
      <>
        <View
          style={[
            styles.flatMedallion,
            {backgroundColor: solidOver(medallion.bg, theme.colors.surface)},
          ]}
        >
          <MaterialIcon color={medallion.fg} name={icon} size={20} />
        </View>
        <AppText
          color={destructive ? 'danger' : undefined}
          style={styles.label}
        >
          {label}
        </AppText>
        {trailingNode}
      </>
    );
    if (!onPress) {
      return <View style={styles.flatRow}>{flatContent}</View>;
    }
    return (
      <Pressable
        accessibilityHint={accessibilityHint ?? 'Chạm để chọn'}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{disabled}}
        disabled={disabled}
        onPress={onPress}
        style={({pressed}) => [
          styles.flatRow,
          pressed && {opacity: theme.states.pressedOpacity},
        ]}
      >
        {flatContent}
      </Pressable>
    );
  }

  const faceStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    ...stickerFace,
  } as const;

  if (!onPress) {
    return (
      <ShelfSurface
        borderRadius={rowRadius}
        containerStyle={rowShadow}
        faceStyle={faceStyle}
      >
        {rowContent}
      </ShelfSurface>
    );
  }

  return (
    <Pressable
      accessibilityHint={accessibilityHint ?? 'Chạm để chọn'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
    >
      {({pressed}) => (
        <ShelfSurface
          shelfHeight={shelf?.height}
          shelfColor={shelf?.color}
          borderRadius={rowRadius}
          isPressed={pressed}
          containerStyle={rowShadow}
          faceStyle={[
            faceStyle,
            !shelf && pressed && {opacity: theme.states.pressedOpacity},
          ]}
        >
          {rowContent}
        </ShelfSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flatMedallion: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  flatRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
