import React from 'react';
import {StyleSheet, Text} from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider, useAppTheme} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {SegmentedTabBar} from '../SegmentedTabBar';

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('SegmentedTabBar', () => {
  it('renders three tabs with correct labels', () => {
    const tree = render(
      <SegmentedTabBar activeTab="lessons" onTabChange={jest.fn()} />,
    );

    const lessonsTab = tree.root.findByProps({testID: 'tab-lessons'});
    const vocabTab = tree.root.findByProps({testID: 'tab-vocabulary'});
    const grammarTab = tree.root.findByProps({testID: 'tab-grammar'});

    expect(lessonsTab).toBeDefined();
    expect(vocabTab).toBeDefined();
    expect(grammarTab).toBeDefined();

    // Check labels are rendered
    const textInstances = tree.root.findAllByType(Text);
    const labels = textInstances.map(node => node.props.children);
    expect(labels).toContain('Bài học');
    expect(labels).toContain('Từ vựng');
    expect(labels).toContain('Ngữ pháp');
  });

  it('highlights the active tab visually', () => {
    const tree = render(
      <SegmentedTabBar activeTab="lessons" onTabChange={jest.fn()} />,
    );

    const lessonsTab = tree.root.findByProps({testID: 'tab-lessons'});
    const vocabTab = tree.root.findByProps({testID: 'tab-vocabulary'});

    // Check that tabs have accessible styles
    expect(lessonsTab.props.style).toBeDefined();
    expect(vocabTab.props.style).toBeDefined();

    // Active tab should be marked with selected state
    expect(lessonsTab.props.accessibilityState.selected).toBe(true);
    expect(vocabTab.props.accessibilityState.selected).toBe(false);
  });

  it('calls onTabChange when a tab is pressed', () => {
    const onTabChange = jest.fn();
    const tree = render(
      <SegmentedTabBar activeTab="lessons" onTabChange={onTabChange} />,
    );

    const vocabTab = tree.root.findByProps({testID: 'tab-vocabulary'});
    act(() => {
      vocabTab.props.onPress();
    });

    expect(onTabChange).toHaveBeenCalledWith('vocabulary');
  });

  it('switches active tab when different tab is pressed', () => {
    const onTabChange = jest.fn();
    const tree = render(
      <SegmentedTabBar activeTab="lessons" onTabChange={onTabChange} />,
    );

    const grammarTab = tree.root.findByProps({testID: 'tab-grammar'});
    act(() => {
      grammarTab.props.onPress();
    });

    expect(onTabChange).toHaveBeenCalledWith('grammar');
  });

  it('displays all three tabs regardless of which is active', () => {
    const onTabChange = jest.fn();
    const tree = render(
      <SegmentedTabBar activeTab="lessons" onTabChange={onTabChange} />,
    );

    // All tabs should exist even when lessons is active
    const lessonsTab = tree.root.findByProps({testID: 'tab-lessons'});
    const vocabTab = tree.root.findByProps({testID: 'tab-vocabulary'});
    const grammarTab = tree.root.findByProps({testID: 'tab-grammar'});

    expect(lessonsTab).toBeDefined();
    expect(vocabTab).toBeDefined();
    expect(grammarTab).toBeDefined();
  });

  it('has accessibility role set to button on each tab', () => {
    const tree = render(
      <SegmentedTabBar activeTab="lessons" onTabChange={jest.fn()} />,
    );

    const lessonsTab = tree.root.findByProps({testID: 'tab-lessons'});
    const vocabTab = tree.root.findByProps({testID: 'tab-vocabulary'});
    const grammarTab = tree.root.findByProps({testID: 'tab-grammar'});

    expect(lessonsTab.props.accessibilityRole).toBe('tab');
    expect(vocabTab.props.accessibilityRole).toBe('tab');
    expect(grammarTab.props.accessibilityRole).toBe('tab');
  });

  it('shows a single sliding indicator with no overlapping bottom borders', () => {
    let surface = '';
    let pill = -1;
    function Probe() {
      const {theme} = useAppTheme();
      surface = theme.colors.surface;
      pill = theme.radius.pill;
      return null;
    }
    const renderWithTab = (tab: 'lessons' | 'vocabulary' | 'grammar') => (
      <FeatureFlagProvider>
        <AppThemeProvider>
          <Probe />
          <SegmentedTabBar activeTab={tab} onTabChange={jest.fn()} />
        </AppThemeProvider>
      </FeatureFlagProvider>
    );
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(renderWithTab('lessons'));
    });

    // Host nodes only: with the Reanimated Jest mock, Animated.View renders
    // straight through to a host View carrying the same testID.
    const findIndicatorHosts = () =>
      tree.root.findAll(
        node =>
          node.props?.testID === 'library-tab-indicator' &&
          typeof node.type === 'string',
      );
    const indicatorStyleOf = () =>
      StyleSheet.flatten(findIndicatorHosts()[0].props.style);

    // Before measurement there is no indicator; tabs alone carry no fill.
    expect(findIndicatorHosts()).toHaveLength(0);

    const fireLayout = (testID: string, x: number, width: number) => {
      act(() => {
        tree.root.findByProps({testID}).props.onLayout({
          nativeEvent: {layout: {x, y: 0, width, height: 48}},
        });
      });
    };
    fireLayout('tab-lessons', 4, 100);
    fireLayout('tab-vocabulary', 108, 100);
    fireLayout('tab-grammar', 212, 100);

    // Exactly one shared indicator (not one fill per tab), placed on the
    // active tab with the app pill radius and no borders.
    expect(findIndicatorHosts()).toHaveLength(1);
    expect(indicatorStyleOf().backgroundColor).toBe(surface);
    expect(indicatorStyleOf().borderRadius).toBe(pill);
    expect(indicatorStyleOf().borderBottomWidth).toBeUndefined();
    expect(indicatorStyleOf().width).toBe(100);
    expect(indicatorStyleOf().transform).toEqual([{translateX: 4}]);

    // Tabs are transparent covers: no borders, no per-tab fill to clash
    // with the indicator (the SETE-215 overlap bug).
    for (const testID of ['tab-lessons', 'tab-vocabulary', 'tab-grammar']) {
      const tabStyle = StyleSheet.flatten(
        tree.root.findByProps({testID}).props.style({pressed: false}),
      );
      expect(tabStyle.borderBottomWidth).toBeUndefined();
      expect(tabStyle.backgroundColor).toBeUndefined();
    }

    // Selecting another tab moves the same indicator to it (it slides on
    // device; the mock applies withTiming synchronously). The second update
    // re-renders so the animated style reflects the post-effect values.
    const showTab = (tab: 'lessons' | 'vocabulary' | 'grammar') => {
      act(() => {
        tree.update(renderWithTab(tab));
      });
      act(() => {
        tree.update(renderWithTab(tab));
      });
    };
    showTab('vocabulary');
    expect(findIndicatorHosts()).toHaveLength(1);
    expect(indicatorStyleOf().width).toBe(100);
    expect(indicatorStyleOf().transform).toEqual([{translateX: 108}]);

    // Reduce-motion: the indicator jumps instead of sliding, still exactly
    // one, still on the selected tab.
    const reduceMotionSpy = jest
      .spyOn(Reanimated, 'useReducedMotion')
      .mockReturnValue(true);
    try {
      showTab('grammar');
      expect(findIndicatorHosts()).toHaveLength(1);
      expect(indicatorStyleOf().width).toBe(100);
      expect(indicatorStyleOf().transform).toEqual([{translateX: 212}]);
    } finally {
      reduceMotionSpy.mockRestore();
    }
  });

  it('keeps a stable >=48dp touch target so switching tabs does not jump layout', () => {
    const tree = render(
      <SegmentedTabBar activeTab="lessons" onTabChange={jest.fn()} />,
    );

    const lessonsTab = tree.root.findByProps({testID: 'tab-lessons'});
    const vocabTab = tree.root.findByProps({testID: 'tab-vocabulary'});
    const grammarTab = tree.root.findByProps({testID: 'tab-grammar'});

    const styles = [lessonsTab, vocabTab, grammarTab].map(node =>
      StyleSheet.flatten(node.props.style({pressed: false})),
    );

    for (const style of styles) {
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    // Same base height for active + inactive → no 1px→2px jump.
    expect(styles[0].minHeight).toBe(styles[1].minHeight);
    expect(styles[1].minHeight).toBe(styles[2].minHeight);
  });

  it('syncs container and tab radius with the app-wide pill radius', () => {
    let pill = -1;
    function Probe() {
      pill = useAppTheme().theme.radius.pill;
      return null;
    }
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <Probe />
            <SegmentedTabBar activeTab="lessons" onTabChange={jest.fn()} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    // Same pill language as Chip, TextField and the bottom TabBar.
    const container = StyleSheet.flatten(
      tree.root.findByProps({testID: 'library-tab-bar'}).props.style,
    );
    const tab = StyleSheet.flatten(
      tree.root.findByProps({testID: 'tab-lessons'}).props.style({
        pressed: false,
      }),
    );
    expect(pill).toBeGreaterThanOrEqual(0);
    expect(container.borderRadius).toBe(pill);
    expect(tab.borderRadius).toBe(pill);
  });
});
