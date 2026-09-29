import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release';
import {AppThemeProvider} from '@ui/theme';
import {
  CompactControlBar,
  type CompactControlBarProps,
  type ControlBarSegment,
} from '../CompactControlBar';

describe('CompactControlBar', () => {
  let activeTrees: renderer.ReactTestRenderer[] = [];

  afterEach(() => {
    activeTrees.forEach(t => {
      act(() => {
        t.unmount();
      });
    });
    activeTrees = [];
  });

  function renderCompactControlBar(
    props: Partial<CompactControlBarProps> = {},
  ) {
    const defaultProps: CompactControlBarProps = {
      segments: [
        {start_ms: 0, end_ms: 2000},
        {start_ms: 2000, end_ms: 4000},
        {start_ms: 4000, end_ms: 6000},
      ],
      activeIndex: 0,
      durationS: 10,
      getCurrentTimeS: jest.fn().mockResolvedValue(0),
      playing: false,
      toolsArmed: false,
      disabled: false,
      onTogglePlay: jest.fn(),
      onReplay: jest.fn(),
      onOpenTools: jest.fn(),
      onSeekToIndex: jest.fn(),
      onSeekToSeconds: jest.fn(),
      ...props,
    };

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <CompactControlBar {...defaultProps} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    activeTrees.push(tree);
    return {tree, props: defaultProps};
  }

  it('renders seek bar ticks without duplicate key warning when segments share the same start_ms', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const duplicateSegments: ControlBarSegment[] = [
      {start_ms: 288000, end_ms: 290000},
      {start_ms: 288000, end_ms: 292000},
      {start_ms: 295000, end_ms: 300000},
    ];

    const {tree} = renderCompactControlBar({
      segments: duplicateSegments,
      durationS: 300,
    });

    const track = tree.root.findByProps({testID: 'youtube-compact-seek'});
    expect(track).toBeDefined();

    const warningCalls = consoleErrorSpy.mock.calls.filter(args =>
      args.some(
        arg =>
          typeof arg === 'string' &&
          (arg.includes('Encountered two children with the same key') ||
            arg.includes(
              'Each child in a list should have a unique "key" prop',
            )),
      ),
    );

    expect(warningCalls).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  it('renders correct sentence label and remaining time', () => {
    const {tree} = renderCompactControlBar({
      activeIndex: 1,
      segments: [
        {start_ms: 0, end_ms: 2000},
        {start_ms: 2000, end_ms: 4000},
        {start_ms: 4000, end_ms: 6000},
      ],
      durationS: 60,
    });

    const label = tree.root.findByProps({testID: 'youtube-compact-label'});
    expect(label.props.children).toBe('Câu 2/3');

    const remaining = tree.root.findByProps({
      testID: 'youtube-compact-remaining',
    });
    expect(remaining.props.children).toBeDefined();
  });

  it('triggers onTogglePlay, onReplay, and onOpenTools when pressed', () => {
    const onTogglePlay = jest.fn();
    const onReplay = jest.fn();
    const onOpenTools = jest.fn();

    const {tree} = renderCompactControlBar({
      activeIndex: 1,
      onTogglePlay,
      onReplay,
      onOpenTools,
      toolsArmed: true,
    });

    const playBtn = tree.root.findByProps({
      testID: 'youtube-compact-play-toggle',
    });
    const replayBtn = tree.root.findByProps({testID: 'youtube-compact-replay'});
    const toolsBtn = tree.root.findByProps({testID: 'youtube-compact-tools'});

    act(() => {
      playBtn.props.onPress();
      replayBtn.props.onPress();
      toolsBtn.props.onPress();
    });

    expect(onTogglePlay).toHaveBeenCalled();
    expect(onReplay).toHaveBeenCalled();
    expect(onOpenTools).toHaveBeenCalled();
  });

  it('handles accessibility actions for increment and decrement', () => {
    const onSeekToIndex = jest.fn();

    const {tree} = renderCompactControlBar({
      activeIndex: 1,
      segments: [
        {start_ms: 0, end_ms: 2000},
        {start_ms: 2000, end_ms: 4000},
        {start_ms: 4000, end_ms: 6000},
      ],
      onSeekToIndex,
    });

    const track = tree.root.findByProps({testID: 'youtube-compact-seek'});

    act(() => {
      track.props.onAccessibilityAction({
        nativeEvent: {actionName: 'increment'},
      });
    });
    expect(onSeekToIndex).toHaveBeenCalledWith(2);

    act(() => {
      track.props.onAccessibilityAction({
        nativeEvent: {actionName: 'decrement'},
      });
    });
    expect(onSeekToIndex).toHaveBeenCalledWith(0);
  });
});
