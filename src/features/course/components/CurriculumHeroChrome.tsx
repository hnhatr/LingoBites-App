import React, {useCallback, useContext, useMemo, useState} from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {AppText} from '@ui/components/AppText';
import {
  HEADER_BUTTON_HIT_SLOP,
  HEADER_BUTTON_SIZE,
  HEADER_ICON_SIZE,
} from '@ui/components/HeaderIconButton';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {HERO_HEIGHT} from './CurriculumHeroCover';

const BAR_HEIGHT = 56;

/**
 * Whether the list has scrolled the hero picture away; pass `onScroll` to
 * the list and `solid` to `CurriculumHeroChrome`.
 */
export function useHeroScroll() {
  const [solid, setSolid] = useState(false);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = event.nativeEvent.contentOffset.y > HERO_HEIGHT - BAR_HEIGHT;
      setSolid(previous => (previous === next ? previous : next));
    },
    [],
  );
  return {solid, onScroll};
}

type Props = {
  title: string;
  onBack: () => void;
  /** Hero scrolled away: show a solid bar with the title behind the button. */
  solid: boolean;
  backLabel?: string;
};

/**
 * The back button floating over a curriculum hero picture, and the bar that
 * fades in with the screen title once the picture has scrolled away.
 */
export function CurriculumHeroChrome({
  title,
  onBack,
  solid,
  backLabel = 'Quay lại',
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View
        pointerEvents="none"
        style={[
          themedStyles.bar,
          {height: topInset + BAR_HEIGHT, paddingTop: topInset},
          !solid && styles.hidden,
        ]}
        testID="curriculum-hero-bar"
      >
        <AppText color="primary" numberOfLines={1} variant="h3">
          {title}
        </AppText>
      </View>
      <Pressable
        accessibilityHint="Về màn trước"
        accessibilityLabel={backLabel}
        accessibilityRole="button"
        hitSlop={HEADER_BUTTON_HIT_SLOP}
        onPress={onBack}
        style={[themedStyles.back, {top: topInset + 8}]}
        testID="screen-header-back"
      >
        <MaterialIcon
          color={theme.colors.primary}
          name="arrow_back"
          size={HEADER_ICON_SIZE}
        />
      </Pressable>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    back: {
      alignItems: 'center',
      backgroundColor: withAlpha(theme.colors.surface, 0.9),
      borderRadius: HEADER_BUTTON_SIZE / 2,
      height: HEADER_BUTTON_SIZE,
      justifyContent: 'center',
      left: theme.gutter,
      position: 'absolute',
      width: HEADER_BUTTON_SIZE,
    },
    bar: {
      backgroundColor: theme.colors.background,
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      paddingLeft: theme.gutter + HEADER_BUTTON_SIZE + theme.spacing.md,
      paddingRight: theme.gutter,
    },
  });
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
