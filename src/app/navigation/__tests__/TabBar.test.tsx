import React from 'react';
import {StyleSheet, Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Reanimated from 'react-native-reanimated';
import {ThemeContext} from '@ui/theme/useAppTheme';
import {coreTheme} from '@ui/theme/themes/core';
import {darkTheme} from '@ui/theme/themes/dark';
import {defaultTheme} from '@ui/theme/themes/default';
import {neoTheme} from '@ui/theme/themes/neo';
import type {AppTheme} from '@ui/theme/types';
import {TabBar, resolveTabGlass} from '../TabBar';
import {
  FLOATING_TAB_BAR_BOTTOM_GAP,
  FLOATING_TAB_BAR_CONTENT_GAP,
  FLOATING_TAB_BAR_HEIGHT,
  getFloatingTabBarClearance,
} from '@ui/components/layout/index';
import {stickerSoftTheme} from '@ui/theme/themes/stickerSoft';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 20, left: 0, right: 0}),
}));

type BarProps = React.ComponentProps<typeof TabBar>;

function makeProps(activeIndex = 0): BarProps {
  const routes = [
    {key: 'home', name: 'Home'},
    {key: 'create', name: 'Create'},
    {key: 'lessons', name: 'Lessons'},
    {key: 'profile', name: 'Profile'},
  ];
  return {
    state: {
      index: activeIndex,
      routes,
      key: 'tab',
      routeNames: routes.map(r => r.name),
      history: [],
      type: 'tab',
      stale: false,
    },
    descriptors: {
      home: {options: {}},
      create: {options: {}},
      lessons: {options: {}},
      profile: {options: {}},
    },
    navigation: {
      emit: jest.fn(() => ({defaultPrevented: false})),
      navigate: jest.fn(),
    },
  } as unknown as BarProps;
}

function renderBar(
  theme: AppTheme,
  props: BarProps = makeProps(),
  extra: Partial<BarProps> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <ThemeContext.Provider
        value={{theme, themeId: 'default' as never, setThemeId: jest.fn()}}
      >
        <TabBar {...props} {...extra} />
      </ThemeContext.Provider>,
    );
  });
  return {tree, props};
}

function measureFirstTab(
  tree: ReactTestRenderer.ReactTestRenderer,
  width = 100,
) {
  act(() => {
    tree.root.findByProps({testID: 'tab-bar-item-Home'}).props.onLayout({
      nativeEvent: {layout: {x: 0, y: 0, width, height: 48}},
    });
  });
}

describe('TabBar floating liquid-glass (SETE-214)', () => {
  it('floats as an absolute overlay so the feed scrolls behind the glass', () => {
    const {tree} = renderBar(defaultTheme);
    const wrap = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-float-wrap'}).props.style,
    );
    expect(wrap.position).toBe('absolute');
    expect(wrap.bottom).toBe(0);
    expect(wrap.left).toBe(0);
    expect(wrap.right).toBe(0);
    // 12px gap + bottom safe-area, like `.tabwrap` in the v3 preview.
    expect(wrap.paddingBottom).toBe(FLOATING_TAB_BAR_BOTTOM_GAP + 20);
    // The overlay (including the bottom safe-area strip) paints nothing
    // itself — the screen's theme background flows edge-to-edge behind it.
    expect(wrap.backgroundColor).toBe('transparent');
    // 4 tabs → pill is near full width and centered.
    expect(wrap.alignItems).toBe('center');
  });

  it('sizes the bar at ~92% width (near full width for 4 tabs)', () => {
    const {tree} = renderBar(defaultTheme);
    // The width lives on the shelf container (direct child of the
    // centered wrap) so the percentage resolves against the screen.
    const container = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-container'}).props.style,
    );
    expect(container.width).toBe('92%');
    expect(container.minWidth).toBe(240);
    expect(container.maxWidth).toBe(380);
    // The face fills the container so the shelf hugs it and peeks only
    // downward — no shelf "ears" on the sides (SETE-269 follow-up).
    const pill = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-glass'}).props.style,
    );
    expect(pill.width).toBe('100%');
  });

  it('gives each tab room on iPhone 17 Pro (402pt)', () => {
    // (402 − 2×16 margin) × 92% ≈ 340pt face, ≈ 83pt per tab —
    // comfortably above the 64pt tab minimum, so "Hồ sơ" stays inside.
    const faceWidth = (402 - 2 * 16) * 0.92;
    expect((faceWidth - 2 * 4) / 4).toBeGreaterThan(64);
  });

  it('fits 4 minimum-width tabs inside the 320pt-screen inner pill', () => {
    const {tree} = renderBar(defaultTheme);
    const pill = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-glass'}).props.style,
    );
    const itemStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-item-Home'}).props.style,
    );
    // 320pt screen: (320 − 2×16 margin) × 92% − 2×4 padding = ~257pt inner.
    const pillWidth = (320 - 2 * 16) * 0.92;
    const innerWidth = pillWidth - 2 * (pill.paddingHorizontal as number);
    expect(4 * (itemStyle.minWidth as number)).toBeLessThanOrEqual(innerWidth);
  });

  it('keeps a visible lift shadow (no overflow clipping on iOS)', () => {
    const {tree} = renderBar(defaultTheme);
    const pill = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-glass'}).props.style,
    );
    // `overflow: hidden` clips shadows on iOS and makes the pill blend
    // into the feed — it must stay off so the shadow renders.
    expect(pill.overflow).not.toBe('hidden');
    expect(pill.shadowOpacity).toBeGreaterThanOrEqual(0.2);
    expect(pill.elevation).toBeGreaterThanOrEqual(12);
  });

  it('renders the 4 current tabs with labels and selected state', () => {
    const {tree} = renderBar(defaultTheme);
    for (const testID of [
      'tab-bar-item-Home',
      'tab-bar-item-Create',
      'tab-bar-item-Lessons',
      'tab-bar-item-Profile',
    ]) {
      expect(tree.root.findByProps({testID}).props.accessibilityRole).toBe(
        'tab',
      );
    }
    expect(
      tree.root.findByProps({accessibilityRole: 'tablist'}).props
        .accessibilityRole,
    ).toBe('tablist');
    expect(
      tree.root.findByProps({testID: 'tab-bar-item-Home'}).props
        .accessibilityState,
    ).toEqual({selected: true});
    expect(
      tree.root.findByProps({testID: 'tab-bar-item-Lessons'}).props
        .accessibilityState,
    ).toEqual({selected: false});
    const labels = tree.root
      .findAllByType(Text)
      .map((n: {props: {children?: unknown}}) => n.props.children);
    expect(labels).toEqual(
      expect.arrayContaining(['Trang chủ', 'Tạo bài', 'Thư viện', 'Hồ sơ']),
    );
  });

  it('shrinks tab labels instead of truncating at large text sizes', () => {
    const {tree} = renderBar(defaultTheme);
    const label = tree.root
      .findAllByType(Text)
      .find(node => node.props.children === 'Tạo bài');
    expect(label).toBeDefined();
    // Single line + shrink-to-fit: no ellipsis even for the longest labels.
    expect(label!.props.numberOfLines).toBe(1);
    expect(label!.props.adjustsFontSizeToFit).toBe(true);
    expect(label!.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
  });

  it('navigates on inactive tab press and ignores the focused tab', () => {
    const {tree, props} = renderBar(defaultTheme);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Lessons'}).props.onPress();
    });
    expect(nav.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'lessons',
      canPreventDefault: true,
    });
    expect(nav.navigate).toHaveBeenCalledWith('Lessons');

    nav.navigate.mockClear();
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Home'}).props.onPress();
    });
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('resets to CreateMain when the Create stack holds a stale fromHome entry (SETE-287 follow-up)', () => {
    // SETE-289: YouTubeHistory moved to the RootStack, so the stale-entry
    // fixture uses YouTubeInput — the branch that still carries fromHome.
    const props = makeProps(0);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create'
          ? {
              ...r,
              state: {
                index: 0,
                routes: [
                  {
                    key: 'yt-input',
                    name: 'YouTubeInput',
                    params: {fromHome: true},
                  },
                ],
              },
            }
          : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    // Bottom-bar exit (Home tab) skipped the header-Back reset, so the
    // Create re-entry must clear the stale video list.
    expect(nav.navigate).toHaveBeenCalledWith('Create', {
      screen: 'CreateMain',
    });
  });

  it('resets a deepened stale stack when any entry carries fromHome (SETE-287 follow-up)', () => {
    // SETE-289: YouTubeHistory moved to the RootStack, so the stale-entry
    // fixture uses YouTubeInput — the branch that still carries fromHome.
    const props = makeProps(0);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create'
          ? {
              ...r,
              state: {
                index: 1,
                routes: [
                  {key: 'create-main', name: 'CreateMain', params: undefined},
                  {
                    key: 'yt-input',
                    name: 'YouTubeInput',
                    params: {fromHome: true},
                  },
                ],
              },
            }
          : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('Create', {
      screen: 'CreateMain',
    });
  });

  it('resets on focused Create re-tap when the stack holds a stale fromHome entry (SETE-310)', () => {
    // Escape hatch: already stuck on the stale screen (Create focused),
    // tapping Create again must pop back to CreateMain.
    const props = makeProps(1);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create'
          ? {
              ...r,
              state: {
                index: 0,
                routes: [
                  {
                    key: 'yt-input',
                    name: 'YouTubeInput',
                    params: {fromHome: true},
                  },
                ],
              },
            }
          : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('Create', {
      screen: 'CreateMain',
    });
  });

  it('resets when the fromHome flag survives only on tab-level params (SETE-310)', () => {
    // Runtime shape: the nested-stack snapshot can lag behind while the
    // deep-navigate residue stays on the Create tab route params.
    const props = makeProps(0);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create'
          ? {...r, params: {screen: 'YouTubeInput', params: {fromHome: true}}}
          : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('Create', {
      screen: 'CreateMain',
    });
  });

  it('resets when the tab route carries a direct fromHome param (SETE-310)', () => {
    const props = makeProps(0);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create' ? {...r, params: {fromHome: true}} : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('Create', {
      screen: 'CreateMain',
    });
  });

  it('pops to CreateMain on focused re-tap of any child screen (SETE-310)', () => {
    // No fromHome anywhere: standard pop-to-top escape hatch.
    const props = makeProps(1);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create'
          ? {
              ...r,
              state: {
                index: 1,
                routes: [
                  {key: 'create-main', name: 'CreateMain', params: undefined},
                  {key: 'paste', name: 'PasteText', params: undefined},
                ],
              },
            }
          : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('Create', {
      screen: 'CreateMain',
    });
  });

  it('ignores focused re-tap when already on CreateMain (SETE-310)', () => {
    const props = makeProps(1);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create'
          ? {
              ...r,
              state: {
                index: 0,
                routes: [
                  {key: 'create-main', name: 'CreateMain', params: undefined},
                ],
              },
            }
          : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('preserves a normal in-tab YouTube stack without fromHome', () => {
    const props = makeProps(0);
    props.state = {
      ...props.state,
      routes: props.state.routes.map(r =>
        r.name === 'Create'
          ? {
              ...r,
              state: {
                index: 1,
                routes: [
                  {key: 'create-main', name: 'CreateMain', params: undefined},
                  {key: 'yt-input', name: 'YouTubeInput', params: undefined},
                ],
              },
            }
          : r,
      ),
    } as unknown as BarProps['state'];
    const {tree} = renderBar(defaultTheme, props);
    const nav = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    act(() => {
      tree.root.findByProps({testID: 'tab-bar-item-Create'}).props.onPress();
    });
    // No fromHome marker: standard tab preserve behavior, no forced reset.
    expect(nav.navigate).toHaveBeenCalledWith('Create');
  });

  it('uses a single sliding accent indicator instead of per-tab fills', () => {
    const {tree} = renderBar(defaultTheme);
    measureFirstTab(tree, 100);

    const findIndicatorHosts = () =>
      tree.root.findAll(
        node =>
          node.props?.testID === 'tab-bar-indicator' &&
          typeof node.type === 'string',
      );
    const indicatorStyleOf = () =>
      StyleSheet.flatten(findIndicatorHosts()[0].props.style);

    expect(findIndicatorHosts()).toHaveLength(1);
    expect(indicatorStyleOf().backgroundColor).toBe(defaultTheme.colors.accent);
    expect(indicatorStyleOf().borderRadius).toBe(defaultTheme.radius.pill);
    // 6pt symmetric inset inside the measured 100pt slot.
    expect(indicatorStyleOf().width).toBe(88);
    expect(indicatorStyleOf().transform).toEqual([{translateX: 6}]);

    for (const testID of [
      'tab-bar-item-Home',
      'tab-bar-item-Create',
      'tab-bar-item-Lessons',
      'tab-bar-item-Profile',
    ]) {
      const tabStyle = StyleSheet.flatten(
        tree.root.findByProps({testID}).props.style,
      );
      expect(tabStyle.backgroundColor).toBeUndefined();
      expect(tree.root.findByProps({testID}).props.hitSlop).toBeDefined();
    }
  });

  it('crossfades icon and label colors via animated styles on the UI thread', () => {
    const {tree} = renderBar(defaultTheme);
    measureFirstTab(tree);

    const activeLabel = tree.root
      .findAllByType(Text)
      .find(node => node.props.children === 'Trang chủ');
    const inactiveLabel = tree.root
      .findAllByType(Text)
      .find(node => node.props.children === 'Thư viện');
    expect(activeLabel).toBeDefined();
    expect(inactiveLabel).toBeDefined();

    const activeLabelStyle = StyleSheet.flatten(activeLabel!.props.style);
    const inactiveLabelStyle = StyleSheet.flatten(inactiveLabel!.props.style);
    expect(activeLabelStyle.color).toBe(defaultTheme.colors.accentInk);
    expect(inactiveLabelStyle.color).toBe(defaultTheme.colors.text.secondary);

    const activeIcon = tree.root.findByProps({name: 'home'});
    const inactiveIcon = tree.root.findByProps({name: 'school'});
    expect(StyleSheet.flatten(activeIcon.props.style).color).toBe(
      defaultTheme.colors.accentInk,
    );
    expect(StyleSheet.flatten(inactiveIcon.props.style).color).toBe(
      defaultTheme.colors.text.secondary,
    );
  });

  it('moves the indicator when the active tab changes', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <ThemeContext.Provider
          value={{
            theme: defaultTheme,
            themeId: 'default' as never,
            setThemeId: jest.fn(),
          }}
        >
          <TabBar {...makeProps(0)} />
        </ThemeContext.Provider>,
      );
    });
    measureFirstTab(tree, 100);

    const indicatorStyleOf = () =>
      StyleSheet.flatten(
        tree.root.findAll(
          node =>
            node.props?.testID === 'tab-bar-indicator' &&
            typeof node.type === 'string',
        )[0].props.style,
      );

    const showTab = (index: number) => {
      act(() => {
        tree.update(
          <ThemeContext.Provider
            value={{
              theme: defaultTheme,
              themeId: 'default' as never,
              setThemeId: jest.fn(),
            }}
          >
            <TabBar {...makeProps(index)} />
          </ThemeContext.Provider>,
        );
      });
      act(() => {
        tree.update(
          <ThemeContext.Provider
            value={{
              theme: defaultTheme,
              themeId: 'default' as never,
              setThemeId: jest.fn(),
            }}
          >
            <TabBar {...makeProps(index)} />
          </ThemeContext.Provider>,
        );
      });
    };

    showTab(1);
    expect(indicatorStyleOf().transform).toEqual([{translateX: 106}]);

    const reduceMotionSpy = jest
      .spyOn(Reanimated, 'useReducedMotion')
      .mockReturnValue(true);
    try {
      showTab(2);
      expect(indicatorStyleOf().transform).toEqual([{translateX: 206}]);
    } finally {
      reduceMotionSpy.mockRestore();
    }
  });

  it('keeps the Sticker indicator for the last tab inside the tab row (SETE-269 P0)', () => {
    const {tree} = renderBar(stickerSoftTheme, makeProps(3));
    measureFirstTab(tree, 100);

    const indicatorStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-indicator'}).props.style,
    );
    const pillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-glass'}).props.style,
    );
    const tabWidth = 100;
    const tabCount = 4;
    const rowStart = pillStyle.paddingHorizontal as number;
    const indicatorStart =
      (indicatorStyle.left as number) +
      (indicatorStyle.transform as [{translateX: number}])[0].translateX;
    const indicatorEnd = indicatorStart + (indicatorStyle.width as number);
    // Symmetric 6pt inset: starts inside the first slot ...
    expect(indicatorStart).toBeGreaterThanOrEqual(rowStart);
    expect(indicatorStart).toBe(rowStart + 3 * tabWidth + 6);
    // ... and the last indicator ends inside the tab row, not past it.
    expect(indicatorEnd).toBeLessThanOrEqual(rowStart + tabCount * tabWidth);
  });

  it('uses accentInk for the selected tab label in the Sticker theme (SETE-311 Task B)', () => {
    // The old Sticker special-case (#ffffff on the accent pill) was 1.86:1 —
    // the selected tab was the least readable text in the bar. The label now
    // matches the icon color (accentInk, 6.21:1 on the accent pill).
    const {tree} = renderBar(stickerSoftTheme, makeProps(0));
    // Animated.Text matches twice (composite + host) — host nodes only,
    // still in tab order.
    const labels = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.children === 'string' &&
        StyleSheet.flatten(node.props.style)?.fontSize === 10.5,
    );
    expect(labels).toHaveLength(4);
    const colors = labels.map(
      node => StyleSheet.flatten(node.props.style)?.color,
    );
    expect(colors[0]).toBe(stickerSoftTheme.colors.accentInk);
    expect(colors.slice(1)).toEqual(['#c8ece7', '#c8ece7', '#c8ece7']);
  });

  it('keeps the selected capsule the same height across themes (SETE-269 follow-up)', () => {
    // The Sticker face is taller (66pt vs ~60pt); a deeper vertical
    // inset keeps the capsule at 50pt so it reads as separated from
    // the shelf instead of merged with it.
    const {tree: stickerTree} = renderBar(stickerSoftTheme);
    measureFirstTab(stickerTree);
    const stickerIndicator = StyleSheet.flatten(
      stickerTree.root.findByProps({testID: 'tab-bar-indicator'}).props.style,
    );
    expect(stickerIndicator.top).toBe(8);
    expect(stickerIndicator.bottom).toBe(8);

    const {tree: defaultTree} = renderBar(defaultTheme);
    measureFirstTab(defaultTree);
    const defaultIndicator = StyleSheet.flatten(
      defaultTree.root.findByProps({testID: 'tab-bar-indicator'}).props.style,
    );
    expect(defaultIndicator.top).toBe(5);
    expect(defaultIndicator.bottom).toBe(5);
  });

  it.each([
    ['default', defaultTheme, 'rgba(255,255,255,0.55)'],
    ['core', coreTheme, 'rgba(255,255,255,0.55)'],
    ['dark', darkTheme, 'rgba(30,41,59,0.48)'],
  ])('tints the glass per theme (%s)', (_id, theme, tint) => {
    expect(resolveTabGlass(theme).tint).toBe(tint);
    const {tree} = renderBar(theme);
    const glass = tree.root.findByProps({testID: 'tab-bar-glass'});
    expect(StyleSheet.flatten(glass.props.style).backgroundColor).toBe(tint);
  });

  it('uses square indicator radius on neo theme', () => {
    const {tree} = renderBar(neoTheme);
    measureFirstTab(tree);
    const indicatorStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-bar-indicator'}).props.style,
    );
    expect(neoTheme.radius.pill).toBe(0);
    expect(indicatorStyle.borderRadius).toBe(0);
  });

  it('renders nothing when the focused stack hides the bar (SETE-255)', () => {
    const props = makeProps();
    const hiddenDescriptors = Object.fromEntries(
      Object.entries(props.descriptors).map(([key, descriptor]) => [
        key,
        {
          ...(descriptor as {options: Record<string, unknown>}),
          options: {tabBarStyle: {display: 'none'}},
        },
      ]),
    );
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <ThemeContext.Provider
          value={{
            theme: defaultTheme,
            themeId: 'default' as never,
            setThemeId: jest.fn(),
          }}
        >
          <TabBar {...props} descriptors={hiddenDescriptors as never} />
        </ThemeContext.Provider>,
      );
    });
    expect(tree.toJSON()).toBeNull();
    expect(
      tree.root.findAllByProps({testID: 'tab-bar-float-wrap'}),
    ).toHaveLength(0);
  });

  it('falls back to opaque surface when glass is disabled', () => {
    const {tree} = renderBar(defaultTheme, makeProps(), {
      glassFallback: true,
    });
    const fallback = tree.root.findByProps({testID: 'tab-bar-fallback'});
    expect(StyleSheet.flatten(fallback.props.style).backgroundColor).toBe(
      defaultTheme.colors.surface,
    );
    measureFirstTab(tree);
    expect(tree.root.findByProps({testID: 'tab-bar-indicator'})).toBeDefined();
  });

  it('reserves bar height + bottom gap + safe-area + gap in feeds', () => {
    expect(getFloatingTabBarClearance(20)).toBe(
      FLOATING_TAB_BAR_HEIGHT +
        FLOATING_TAB_BAR_BOTTOM_GAP +
        20 +
        FLOATING_TAB_BAR_CONTENT_GAP,
    );
  });

  it('enforces useFloatingTabBarClearance on scrollable screens', () => {
    const fs = require('fs');
    const path = require('path');
    const walk = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file: string) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(file));
        } else {
          if (file.endsWith('Screen.tsx') || file.endsWith('Activity.tsx')) {
            results.push(file);
          }
        }
      });
      return results;
    };
    const screens = walk(path.join(__dirname, '../../../modules'));
    const missing: string[] = [];
    for (const screen of screens) {
      const code = fs.readFileSync(screen, 'utf8');
      const hasScroll =
        code.includes('<ScrollView') || code.includes('<FlatList');
      if (!hasScroll) continue;

      if (
        !code.includes('useFloatingTabBarClearance') &&
        !code.includes('IGNORE_TAB_BAR_CLEARANCE')
      ) {
        missing.push(path.basename(screen));
      }
    }

    // Whitelist legacy screens that haven't been updated yet (SETE-251 etc).
    // New screens with ScrollView/FlatList will fail if they don't import useFloatingTabBarClearance.
    const legacyExemptions = [
      'TtsSpikeScreen.tsx',
      'PracticeScreen.tsx',
      'SentenceDetailScreen.tsx',
      'TodayScreen.tsx',
      'DailyReviewScreen.tsx',
      'WordDetailScreen.tsx',
      'PrivacyNoteScreen.tsx',
      'ProfileScreen.tsx',
      'ProgressReportScreen.tsx',
      'GrammarDetailScreen.tsx',
      'FeatureStatusScreen.tsx',
      'OCRReviewScreen.tsx',
      'FlashcardListScreen.tsx',
      'ProgressiveLessonScreen.tsx',
      'HomeScreen.tsx',
      'ImageCaptureScreen.tsx',
      'CreateScreen.tsx',
      'YouTubeHistoryScreen.tsx',
      'YouTubeManualTranscriptScreen.tsx',
      'YouTubeInputScreen.tsx',
      'YouTubeLessonScreen.tsx',
    ];
    const actuallyMissing = missing.filter(m => !legacyExemptions.includes(m));
    expect(actuallyMissing).toEqual([]);
  });
});
