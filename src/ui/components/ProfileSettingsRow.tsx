import React from 'react';
import {Pressable, View} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {useAppTheme} from '../theme';
import {AppText} from './AppText';
import {Chip, type ChipTone} from './Chip';
import {MaterialIcon} from './MaterialIcon';

type MedallionTone = 'teal' | 'coral' | 'gold';

type Props = {
  icon: HandoffIconName;
  label: string;
  medallionTone?: MedallionTone;
  trailing?: 'chevron' | {text: string} | {chip: string; chipTone?: ChipTone};
  onPress?: () => void;
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
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const {theme} = useAppTheme();
  const medallion = medallionColors(theme, medallionTone);
  const shelf = theme.shelf?.surface;

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
          backgroundColor: medallion.bg,
          borderRadius: 999,
          height: 42,
          justifyContent: 'center',
          width: 42,
        }}
      >
        <MaterialIcon color={medallion.fg} name={icon} size={22} />
      </View>
      <AppText style={{flex: 1, fontSize: 16, fontWeight: '600'}}>
        {label}
      </AppText>
      {trailingNode}
    </>
  );

  const faceStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
  } as const;

  if (!onPress) {
    return (
      <ShelfSurface
        borderRadius={22}
        containerStyle={theme.shadow.soft}
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
      onPress={onPress}
    >
      {({pressed}) => (
        <ShelfSurface
          shelfHeight={shelf?.height}
          shelfColor={shelf?.color}
          borderRadius={22}
          isPressed={pressed}
          containerStyle={theme.shadow.soft}
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
