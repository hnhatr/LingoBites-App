import React from 'react';
import {Pressable, View} from 'react-native';
import {AppText} from './AppText';
import type {HandoffIconName} from './icons/iconRegistry';
import {MaterialIcon} from './MaterialIcon';
import {useAppTheme} from '../theme';
import type {LessonCardView} from '../types/lesson';
import {ShelfSurface} from './ShelfSurface';

const THUMB_ICONS: readonly HandoffIconName[] = [
  'sell',
  'restaurant_menu',
  'menu_book',
];

type Props = {
  lesson: LessonCardView;
  index: number;
  onPress?: () => void;
};

export function RecentLessonRow({lesson, index, onPress}: Props) {
  const {theme} = useAppTheme();
  const thumbTone = index % 2 === 0 ? 'teal' : 'coral';
  const thumbBg =
    thumbTone === 'teal' ? theme.colors.accentSoft : theme.colors.secondarySoft;
  const thumbColor =
    thumbTone === 'teal' ? theme.colors.primary : theme.colors.secondary;
  const iconName = THUMB_ICONS[index % THUMB_ICONS.length];
  const shelf = theme.shelf?.surface;

  const rowContent = (
    <>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: thumbBg,
          borderRadius: 999, // bong bóng icon pill
          height: 42,
          justifyContent: 'center',
          width: 42,
        }}
      >
        <MaterialIcon color={thumbColor} name={iconName} size={22} />
      </View>
      <View style={{flex: 1, gap: 2, minWidth: 0}}>
        <AppText numberOfLines={1} variant="label">
          {lesson.title}
        </AppText>
        <AppText color="muted" variant="caption">
          {lesson.meta}
        </AppText>
      </View>
      <MaterialIcon
        color={theme.colors.text.secondary}
        name="chevron_right"
        size={22}
      />
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
      accessibilityLabel={`${lesson.title}, ${lesson.meta}`}
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
