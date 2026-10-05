import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

export type LibraryTabId = 'lessons' | 'courses' | 'vocabulary' | 'grammar';

export interface SegmentedTabBarProps {
  activeTab: LibraryTabId;
  onTabChange: (tab: LibraryTabId) => void;
}

const TABS = [
  {id: 'lessons' as const, label: 'Bài học'},
  {id: 'courses' as const, label: 'Khóa học'},
  {id: 'vocabulary' as const, label: 'Từ vựng'},
  {id: 'grammar' as const, label: 'Ngữ pháp'},
];

type TabLayout = {x: number; width: number};

const INDICATOR_DURATION_MS = 200;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.radius.pill,
      padding: theme.spacing.xs,
      marginHorizontal: theme.gutter,
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    indicator: {
      position: 'absolute',
      top: theme.spacing.xs,
      bottom: theme.spacing.xs,
      left: 0,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      ...theme.shadow.soft,
    },
    tab: {
      flex: 1,
      minHeight: 48,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      zIndex: 1,
    },
  });
}

export function SegmentedTabBar({
  activeTab,
  onTabChange,
}: SegmentedTabBarProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reducedMotion = useReducedMotion();
  const [layouts, setLayouts] = useState<
    Partial<Record<LibraryTabId, TabLayout>>
  >({});
  // UI-thread values: the indicator keeps sliding smoothly even while the
  // JS thread is busy rendering the newly selected tab's content.
  const translateX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const hasPositioned = useRef(false);

  const handleLayout = (id: LibraryTabId) => (event: LayoutChangeEvent) => {
    const {x, width} = event.nativeEvent.layout;
    setLayouts(prev =>
      prev[id]?.x === x && prev[id]?.width === width
        ? prev
        : {...prev, [id]: {x, width}},
    );
  };

  const activeLayout = layouts[activeTab];

  useEffect(() => {
    if (!activeLayout) {
      return;
    }
    if (!hasPositioned.current || reducedMotion) {
      // First measurement or reduce-motion: place instantly, no animation.
      hasPositioned.current = true;
      translateX.value = activeLayout.x;
      indicatorWidth.value = activeLayout.width;
      return;
    }
    const timing = {
      duration: INDICATOR_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    };
    translateX.value = withTiming(activeLayout.x, timing);
    indicatorWidth.value = withTiming(activeLayout.width, timing);
  }, [activeLayout, activeTab, indicatorWidth, reducedMotion, translateX]);

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    transform: [{translateX: translateX.value}],
  }));

  return (
    <View
      testID="library-tab-bar"
      style={styles.container}
      accessibilityRole="tablist"
      accessibilityLabel="Danh mục thư viện"
      accessibilityHint="Chứa các tab Bài học, Khóa học, Từ vựng và Ngữ pháp"
    >
      {activeLayout ? (
        <Animated.View
          testID="library-tab-indicator"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[styles.indicator, indicatorAnimatedStyle]}
        />
      ) : null}
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            testID={`tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityState={{selected: isActive}}
            accessibilityLabel={tab.label}
            accessibilityHint={`Chạm để xem ${tab.label}`}
            onPress={() => onTabChange(tab.id)}
            onLayout={handleLayout(tab.id)}
            style={({pressed}) => [
              styles.tab,
              pressed && {opacity: theme.states.pressedOpacity},
            ]}
          >
            <AppText
              variant="label"
              color={isActive ? 'primary' : 'secondary'}
              numberOfLines={1}
              style={{
                fontWeight: isActive
                  ? theme.typography.weight.bold
                  : theme.typography.weight.medium,
              }}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
