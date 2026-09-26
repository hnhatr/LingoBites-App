import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type {HandoffIconName} from '@components/icons/iconRegistry';
import {AnimatedMaterialIcon} from '@components/MaterialIcon';
import {useAppTheme, type AppTheme} from '@theme';
import {useTranslation} from 'react-i18next';
import {
  FLOATING_TAB_BAR_BOTTOM_GAP,
  FLOATING_TAB_BAR_HORIZONTAL_MARGIN,
  withAlpha,
} from './tabBarMetrics';
import {isTabBarHiddenForDescriptors} from './immersiveTabRoutes';
import {ShelfSurface} from '@components/ShelfSurface';

const TAB_ITEMS: Record<string, {labelKey: string; icon: HandoffIconName}> = {
  Home: {labelKey: 'nav.tab.home', icon: 'home'},
  Create: {labelKey: 'nav.tab.create', icon: 'document_scanner'},
  Lessons: {labelKey: 'nav.tab.library', icon: 'school'},
  Profile: {labelKey: 'nav.tab.profile', icon: 'person'},
};

const TAB_ITEM_HIT_SLOP = {top: 8, bottom: 8, left: 8, right: 8};
const TAB_ICON_SIZE = 21;

type CreateTabRouteState = {
  state?: {
    index?: number;
    routes?: Array<{name?: string; params?: unknown}>;
  };
  params?: unknown;
};

function findCreateRoute(
  tabState: BottomTabBarProps['state'],
): CreateTabRouteState | undefined {
  return tabState.routes.find(r => r.name === 'Create') as
    | CreateTabRouteState
    | undefined;
}

/**
 * SETE-287 follow-up: Home opens YouTubeInput directly in the Create stack
 * with `fromHome: true` (SETE-289: YouTubeHistory moved to the RootStack
 * above the tabs; SETE-310: its "create new" CTA carries the same flag).
 * If the user leaves via the bottom bar (Home tab) instead of the header
 * Back button, the Create stack stays rooted at that YouTube screen. The
 * next Create tap must reset to CreateMain instead of resurfacing the
 * stale screen. Returns true when any route in the nested Create stack
 * carries `params.fromHome === true`.
 *
 * SETE-310 follow-up: a simulator pass showed the nested-stack snapshot
 * exposed here can lag behind the params the screen itself sees, while
 * the deep-navigate residue (`navigate('Tabs', {screen: 'Create',
 * params: {screen, params: {fromHome: true}}})`) survives on the Create
 * tab route's own params. Check that level too so the reset cannot be
 * silently skipped at runtime.
 */
export function createStackHasFromHomeEntry(
  tabState: BottomTabBarProps['state'],
): boolean {
  const createRoute = findCreateRoute(tabState);
  const tabParams = createRoute?.params as
    | {fromHome?: boolean; params?: {fromHome?: boolean} | undefined}
    | undefined;
  if (tabParams?.fromHome === true || tabParams?.params?.fromHome === true) {
    return true;
  }
  const nestedRoutes = createRoute?.state?.routes;
  if (!nestedRoutes) {
    return false;
  }
  return nestedRoutes.some(
    r => (r.params as {fromHome?: boolean} | undefined)?.fromHome === true,
  );
}

/**
 * SETE-310 follow-up: true when the Create stack's focused route is
 * anything but CreateMain (a child screen is showing). Used for the
 * focused-tab re-tap escape hatch — the standard tab pop-to-top the
 * custom bar previously swallowed by ignoring focused taps.
 */
export function createStackIsBeyondMain(
  tabState: BottomTabBarProps['state'],
): boolean {
  const nested = findCreateRoute(tabState)?.state;
  const routes = nested?.routes;
  if (!routes || routes.length === 0) {
    return false;
  }
  const focusedNested = routes[nested?.index ?? routes.length - 1];
  return focusedNested?.name !== 'CreateMain';
}

const INDICATOR_DURATION_MS = 200;
/**
 * Symmetric inset of the sliding indicator inside each tab slot
 * (SETE-269 P0). The indicator previously spanned the full measured
 * slot width from a 6pt base offset, so the last (Profile) indicator
 * ended outside the tab row and the Sticker pill looked broken.
 */
const INDICATOR_INSET = 6;
/**
 * Horizontal padding of the pill face where the tab row starts. The
 * indicator's base offset must match it or every tab misaligns by the
 * difference (and the last one escapes the row).
 */
const PILL_CONTENT_PADDING = 4;

type TabBarProps = BottomTabBarProps & {
  /**
   * Forces the opaque fallback (solid `surface` background) used on devices
   * without blur/translucency support. Defaults to the translucent
   * liquid-glass treatment.
   */
  glassFallback?: boolean;
};

/**
 * Resolves the theme-tinted glass colors for the floating pill.
 * Light themes use `surface` at ~55%, dark themes at ~48% (SETE-213 v3).
 */
export function resolveTabGlass(theme: AppTheme) {
  const isDark = theme.id === 'dark';
  return {
    isDark,
    tint: withAlpha(theme.colors.surface, isDark ? 0.48 : 0.55),
    // Slightly stronger than the v3 spec's 50% so the pill edge reads
    // against light feeds (see SETE-214 screenshot feedback).
    border: withAlpha(theme.colors.outlineVariant, 0.6),
    gloss: 'rgba(255,255,255,0.12)',
    innerHighlight: 'rgba(255,255,255,0.5)',
    fallback: theme.colors.surface,
  };
}

type TabBarItemProps = {
  index: number;
  route: BottomTabBarProps['state']['routes'][number];
  focused: boolean;
  label: string;
  icon: HandoffIconName;
  progress: SharedValue<number>;
  theme: AppTheme;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

function TabBarItem({
  index,
  route,
  focused,
  label,
  icon,
  progress,
  theme,
  onPress,
  onLayout,
}: TabBarItemProps) {
  const isSticker = !!theme.shelf;
  const unselectedColor = isSticker ? '#c8ece7' : theme.colors.text.secondary;
  // SETE-311 Task B: the selected label uses accentInk like the icon in
  // every theme. The Sticker special-case (#ffffff on the accent pill) was
  // 1.86:1 — the selected tab was the least readable text in the bar.
  const selectedTextColor = theme.colors.accentInk;
  const selectedIconColor = isSticker
    ? theme.colors.accentInk
    : theme.colors.accentInk;

  const captionPreset = theme.typography.presets.caption;

  const animatedIconColorStyle = useAnimatedStyle(
    () => ({
      color: interpolateColor(
        progress.value,
        [index - 1, index, index + 1],
        [unselectedColor, selectedIconColor, unselectedColor],
      ),
    }),
    [selectedIconColor, index, unselectedColor],
  );

  const animatedTextColorStyle = useAnimatedStyle(
    () => ({
      color: interpolateColor(
        progress.value,
        [index - 1, index, index + 1],
        [unselectedColor, selectedTextColor, unselectedColor],
      ),
    }),
    [selectedTextColor, index, unselectedColor],
  );

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{selected: focused}}
      hitSlop={TAB_ITEM_HIT_SLOP}
      onLayout={onLayout}
      onPress={onPress}
      style={{
        alignItems: 'center',
        borderRadius: theme.radius.pill,
        flex: 1,
        gap: isSticker ? 2 : 1,
        justifyContent: 'center',
        minWidth: 64,
        paddingHorizontal: 8,
        paddingVertical: 4,
        zIndex: 1,
        height: '100%',
      }}
      testID={`tab-bar-item-${route.name}`}
    >
      <AnimatedMaterialIcon
        name={icon}
        size={TAB_ICON_SIZE}
        style={animatedIconColorStyle}
      />
      <Animated.Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={captionPreset.maxFontSizeMultiplier}
        minimumFontScale={0.85}
        numberOfLines={1}
        style={[
          {
            fontFamily: theme.typography.fontFamily.display,
            fontSize: 10.5,
            fontWeight: focused ? '700' : '600',
            lineHeight: 13,
          },
          animatedTextColorStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export function TabBar({
  state,
  descriptors,
  navigation,
  glassFallback = false,
}: TabBarProps) {
  const {theme} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const glass = resolveTabGlass(theme);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(state.index);
  const tabWidth = useSharedValue(0);
  const hasAnimated = useRef(false);
  const [indicatorReady, setIndicatorReady] = useState(false);
  // Immersive routes (review session, lesson runtime, speaking — SETE-255)
  // hide the bar via tabBarStyle display:none; the custom bar must honor it
  // itself (see isTabBarHiddenForDescriptors). Read before the early return
  // so hook order stays stable when visibility toggles.
  const hidden = isTabBarHiddenForDescriptors(state, descriptors);

  useEffect(() => {
    if (reducedMotion || !hasAnimated.current) {
      progress.value = state.index;
      hasAnimated.current = true;
      return;
    }
    progress.value = withTiming(state.index, {
      duration: INDICATOR_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reducedMotion, state.index]);

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    width: Math.max(tabWidth.value - INDICATOR_INSET * 2, 0),
    transform: [
      {translateX: progress.value * tabWidth.value + INDICATOR_INSET},
    ],
  }));

  const handleTabLayout = (event: LayoutChangeEvent) => {
    const {width} = event.nativeEvent.layout;
    if (width <= 0 || tabWidth.value > 0) {
      return;
    }
    tabWidth.value = width;
    setIndicatorReady(true);
  };

  if (hidden) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.floatWrap,
        {
          paddingBottom: FLOATING_TAB_BAR_BOTTOM_GAP + insets.bottom,
        },
      ]}
      testID="tab-bar-float-wrap"
    >
      <ShelfSurface
        shelfHeight={theme.shelf?.tabBar?.height}
        shelfColor={theme.shelf?.tabBar?.color}
        borderRadius={theme.radius.pill}
        containerStyle={styles.shelfContainer}
        containerTestID="tab-bar-container"
        faceTestID={glassFallback ? 'tab-bar-fallback' : 'tab-bar-glass'}
        faceStyle={[
          styles.pill,
          {
            borderColor: glass.border,
            backgroundColor: theme.shelf
              ? theme.colors.primary
              : glassFallback
              ? glass.fallback
              : glass.tint,
            borderWidth: theme.shelf ? 0 : 1, // Sticker Soft doesn't use border for the bar
            height: theme.shelf ? 66 : undefined,
          },
        ]}
      >
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          testID={glassFallback ? 'tab-bar-fallback' : 'tab-bar-glass'}
        >
          {!glassFallback && !theme.shelf ? (
            <>
              {/* Top gloss: white 12% fading down (gradient stand-in;
                  install @react-native-community/blur + a gradient layer for
                  true native blur — see SETE-214 handoff). */}
              <View
                pointerEvents="none"
                style={[styles.gloss, {backgroundColor: glass.gloss}]}
              />
              {/* Inner top highlight line. */}
              <View
                pointerEvents="none"
                style={[
                  styles.innerHighlight,
                  {borderTopColor: glass.innerHighlight},
                ]}
              />
            </>
          ) : null}
        </View>
        {indicatorReady ? (
          <Animated.View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
              styles.indicator,
              indicatorAnimatedStyle,
              {
                backgroundColor: theme.shelf
                  ? theme.colors.accent
                  : theme.colors.accent,
              },
            ]}
            testID="tab-bar-indicator"
          />
        ) : null}
        <View
          accessibilityRole="tablist"
          style={{flexDirection: 'row', flex: 1, height: '100%'}}
        >
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const item = TAB_ITEMS[route.name] ?? {
              labelKey: '',
              icon: 'circle' as HandoffIconName,
            };
            const label = item.labelKey
              ? t(item.labelKey)
              : descriptors[route.key].options.title ?? route.name;

            return (
              <TabBarItem
                key={route.key}
                focused={focused}
                icon={item.icon}
                index={index}
                label={label}
                onLayout={index === 0 ? handleTabLayout : undefined}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (event.defaultPrevented) {
                    return;
                  }
                  // SETE-287 follow-up: a stale fromHome YouTube entry
                  // survives a bottom-bar exit (Home tab) because the
                  // header-Back reset never ran. Reset on Create re-entry
                  // so the lesson composer is reachable again. Normal
                  // in-tab stacks (no fromHome) keep standard preserve
                  // behavior. Handles the focused-tab tap too as an
                  // escape hatch when already stuck on the stale screen.
                  // SETE-310 follow-up: focused re-tap on any child
                  // screen pops back to CreateMain (standard tab
                  // pop-to-top) so no child screen is ever a dead end.
                  if (route.name === 'Create') {
                    if (createStackHasFromHomeEntry(state)) {
                      navigation.navigate('Create', {screen: 'CreateMain'});
                      return;
                    }
                    if (focused && createStackIsBeyondMain(state)) {
                      navigation.navigate('Create', {screen: 'CreateMain'});
                      return;
                    }
                  }
                  if (!focused) {
                    navigation.navigate(route.name);
                  }
                }}
                progress={progress}
                route={route}
                theme={theme}
              />
            );
          })}
        </View>
      </ShelfSurface>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    floatWrap: {
      // Absolute overlay (like `.tabwrap` in the SETE-213 v3 preview):
      // the feed scrolls *behind* the pill so the glass has content to
      // show through. Feed screens reserve clearance via
      // useFloatingTabBarClearance() so the last row is never covered.
      // 4 tabs → the pill is near full width and centered.
      alignItems: 'center',
      backgroundColor: 'transparent',
      bottom: 0,
      left: 0,
      paddingHorizontal: FLOATING_TAB_BAR_HORIZONTAL_MARGIN,
      paddingTop: 8,
      position: 'absolute',
      right: 0,
    },
    shelfContainer: {
      // The bar width lives on this container (direct child of the
      // centered wrap) so the 92% resolves against the screen width.
      // The face below fills it at 100% so the shelf hugs the face and
      // peeks only downward per the Sticker spec — a stretched container
      // with a 92% face would leave 15pt shelf "ears" on each side.
      // 4 tabs → ~340pt on iPhone 17 Pro (SETE-247).
      maxWidth: 380,
      minWidth: 240,
      width: '92%',
    },
    pill: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      elevation: 16,
      flexDirection: 'row',
      justifyContent: 'space-around',
      // Fills the shelf container (which carries the 92% / min / max
      // width): 4 × 64pt floor = 256pt fits the 320pt-screen inner pill
      // (~257pt); labels shrink via adjustsFontSizeToFit instead of
      // truncating.
      width: '100%',
      // NOTE: no `overflow: 'hidden'` here — on iOS it clips the shadow
      // and the pill loses all lift (SETE-214 screenshot feedback).
      // Children are all inside the bounds so nothing needs clipping.
      // Keep in sync with PILL_CONTENT_PADDING (indicator base offset).
      paddingHorizontal: PILL_CONTENT_PADDING,
      paddingVertical: 5,
      shadowColor: '#0a0a28',
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.22,
      shadowRadius: 28,
    },
    indicator: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      // The Sticker face is taller (66pt vs ~60pt). A deeper vertical
      // inset keeps the selected capsule the same 50pt height as other
      // themes, leaving clear breathing room so the highlight never
      // reads as merged with the shelf below (SETE-269 follow-up).
      bottom: theme.shelf ? 8 : 5,
      // Aligns with the tab row start (pill horizontal padding); the
      // worklet adds INDICATOR_INSET so the fill sits inside each slot.
      left: PILL_CONTENT_PADDING,
      position: 'absolute',
      top: theme.shelf ? 8 : 5,
    },
    gloss: {
      borderTopLeftRadius: theme.radius.pill,
      borderTopRightRadius: theme.radius.pill,
      height: '55%',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    innerHighlight: {
      borderTopLeftRadius: theme.radius.pill,
      borderTopRightRadius: theme.radius.pill,
      borderTopWidth: 1,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  });
}
