import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {AppText} from './AppText';
import {Chip} from './Chip';
import {MaterialIcon} from './MaterialIcon';

type MedallionTone = 'teal' | 'coral' | 'gold';

type Props = {
  icon: HandoffIconName;
  title: string;
  subtitle: string;
  medallionTone?: MedallionTone;
  badge?: string;
  onPress?: () => void;
  disabled?: boolean;
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

export function LessonExploreRow({
  icon,
  title,
  subtitle,
  medallionTone = 'teal',
  badge,
  onPress,
  disabled = false,
}: Props) {
  const {theme} = useAppTheme();
  const medallion = medallionColors(theme, medallionTone);
  const themedStyles = React.useMemo(
    () => makeStyles(theme, medallion.bg, disabled, badge),
    [badge, disabled, medallion.bg, theme],
  );
  const shelf = theme.shelf?.surface;

  const rowContent = (
    <>
      {badge ? (
        <View style={styles.badge}>
          <Chip label={badge} tone="coralSoft" />
        </View>
      ) : null}
      <View style={themedStyles.medallion}>
        <MaterialIcon color={medallion.fg} name={icon} size={22} />
      </View>
      <View style={themedStyles.copy}>
        <AppText style={styles.title}>{title}</AppText>
        <AppText color="muted" variant="caption">
          {subtitle}
        </AppText>
      </View>
      {onPress && !disabled ? (
        <MaterialIcon
          color={theme.colors.text.secondary}
          name="chevron_right"
          size={22}
        />
      ) : null}
    </>
  );

  const faceStyle = themedStyles.row;

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
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
    >
      {({pressed}) => (
        <ShelfSurface
          shelfHeight={shelf?.height}
          shelfColor={shelf?.color}
          borderRadius={22}
          isPressed={pressed}
          isDisabled={disabled}
          containerStyle={theme.shadow.soft}
          faceStyle={[
            faceStyle,
            !shelf &&
              pressed &&
              !disabled && {opacity: theme.states.pressedOpacity},
          ]}
        >
          {rowContent}
        </ShelfSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 14,
    top: 10,
    zIndex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
});

function makeStyles(
  theme: AppTheme,
  medallionBackground: string,
  disabled: boolean,
  badge?: string,
) {
  return StyleSheet.create({
    copy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
      paddingRight: badge ? 48 : 0,
    },
    medallion: {
      alignItems: 'center',
      backgroundColor: medallionBackground,
      borderRadius: 999,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 15,
      paddingVertical: 13,
      position: 'relative',
    },
  });
}
