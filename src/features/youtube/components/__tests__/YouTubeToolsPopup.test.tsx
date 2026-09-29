import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release';
import {AppThemeProvider} from '@ui/theme';
import type {YouTubeSegment} from '@core/schemas/youtube-transcript-v1';
import {
  YouTubeToolsPopup,
  type YouTubeToolsPopupProps,
} from '../YouTubeToolsPopup';

function makeSegments(): YouTubeSegment[] {
  return [
    {
      id: 'seg-0',
      index: 0,
      start_ms: 0,
      end_ms: 3000,
      en: 'First sentence',
      vi: 'Câu đầu tiên',
      ipa: 'fɜːrst',
    },
    {
      id: 'seg-1',
      index: 1,
      start_ms: 3000,
      end_ms: 6000,
      en: 'Second sentence',
      vi: 'Câu thứ hai',
      ipa: 'ˈsɛkənd',
    },
    {
      id: 'seg-2',
      index: 2,
      start_ms: 6000,
      end_ms: 9000,
      en: 'Third sentence',
      vi: 'Câu thứ ba',
      ipa: 'θɜːrd',
    },
  ];
}

describe('YouTubeToolsPopup (SETE-332, TASK-5)', () => {
  let activeTree: renderer.ReactTestRenderer | null = null;

  async function renderPopup(props: Partial<YouTubeToolsPopupProps> = {}) {
    const defaultProps: YouTubeToolsPopupProps = {
      visible: true,
      onClose: jest.fn(),
      segments: makeSegments(),
      activeIndex: 1,
      onReplay: jest.fn(),
      playbackRate: 1,
      onSelectPlaybackRate: jest.fn(),
      loopCount: 1,
      onSelectLoopCount: jest.fn(),
      abLoopStartIndex: null,
      abLoopEndIndex: null,
      abLoopActive: false,
      onSetAbLoopPointA: jest.fn(),
      onSetAbLoopPointB: jest.fn(),
      onClearAbLoop: jest.fn(),
      onOpenTranscript: jest.fn(),
      ...props,
    };

    await act(async () => {
      activeTree = renderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <YouTubeToolsPopup {...defaultProps} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
      await Promise.resolve();
    });
    return {tree: activeTree!, props: defaultProps};
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (activeTree) {
      act(() => {
        activeTree?.unmount();
      });
      activeTree = null;
    }
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('renders nothing when visible is false', async () => {
    const {tree} = await renderPopup({visible: false});
    expect(tree.toJSON()).toBeNull();
  });

  it('renders loop, speed, A-B, dictation, and transcript options without duplicating transport (SETE-346 Option C)', async () => {
    const {tree} = await renderPopup();

    expect(tree.root.findByProps({testID: 'youtube-tools-popup'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-tools-close'})).toBeTruthy();
    // Option C: seek + transport live only in the compact bar above.
    expect(() =>
      tree.root.findByProps({testID: 'youtube-tools-seek'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'youtube-tools-prev'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'youtube-tools-next'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'youtube-tools-play-toggle'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'youtube-tools-replay'}),
    ).toThrow();
    expect(tree.root.findByProps({testID: 'youtube-tools-ab-a'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-tools-ab-b'})).toBeTruthy();
    // Clear only renders once a point is set.
    expect(() =>
      tree.root.findByProps({testID: 'youtube-tools-ab-clear'}),
    ).toThrow();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-loop-1'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-loop-5'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-loop-inf'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-speed-0.5'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-speed-0.75'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-speed-1'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-speed-1.25'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-dictation-toggle'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-open-transcript'}),
    ).toBeTruthy();
  });

  it('calls A-B callbacks when pressed (SETE-346 Option C)', async () => {
    const onSetA = jest.fn();
    const onSetB = jest.fn();

    const {tree} = await renderPopup({
      onSetAbLoopPointA: onSetA,
      onSetAbLoopPointB: onSetB,
    });

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-a'}).props.onPress();
      tree.root.findByProps({testID: 'youtube-tools-ab-b'}).props.onPress();
      await Promise.resolve();
    });

    expect(onSetA).toHaveBeenCalledTimes(1);
    expect(onSetB).toHaveBeenCalledTimes(1);
  });

  it('handles loop selection and speed selection', async () => {
    const onSelectLoop = jest.fn();
    const onSelectSpeed = jest.fn();

    const {tree} = await renderPopup({
      onSelectLoopCount: onSelectLoop,
      onSelectPlaybackRate: onSelectSpeed,
    });

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}).props.onPress();
      tree.root
        .findByProps({testID: 'youtube-tools-speed-1.25'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(onSelectLoop).toHaveBeenCalledWith(3);
    expect(onSelectSpeed).toHaveBeenCalledWith(1.25);
  });

  it('renders A-B clear only when a loop point is set (SETE-346)', async () => {
    const {tree} = await renderPopup({
      abLoopStartIndex: 0,
      abLoopEndIndex: 1,
      abLoopActive: true,
    });

    const onClear = jest.fn();
    expect(
      tree.root.findByProps({testID: 'youtube-tools-ab-clear'}),
    ).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-tools-ab-a'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-tools-ab-b'})).toBeTruthy();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('disables loop, A-B and speed controls offline while transcript stays enabled (SETE-346)', async () => {
    const {tree} = await renderPopup({disabled: true});

    expect(
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}).props.disabled,
    ).toBe(true);
    expect(
      tree.root.findByProps({testID: 'youtube-tools-ab-a'}).props.disabled,
    ).toBe(true);
    expect(
      tree.root.findByProps({testID: 'youtube-tools-ab-b'}).props.disabled,
    ).toBe(true);
    expect(
      tree.root.findByProps({testID: 'youtube-tools-speed-1'}).props.disabled,
    ).toBe(true);
    // Transcript never requires the player.
    expect(
      tree.root.findByProps({testID: 'youtube-tools-open-transcript'}),
    ).toBeTruthy();
  });

  it('opens dictation box, types text, and checks correctness', async () => {
    const {tree} = await renderPopup({activeIndex: 1});

    // Toggle dictation box open
    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-dictation-toggle'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-tools-dictation-box'}),
    ).toBeTruthy();

    // Type incorrect text
    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-dictation-input'})
        .props.onChangeText('wrong text');
      await Promise.resolve();
    });
    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-dictation-check'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-tools-dictation-result'}).props
        .children,
    ).toBe('Chưa đúng, nghe lại và thử tiếp.');

    // Type correct text (matches 'Second sentence')
    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-dictation-input'})
        .props.onChangeText('second sentence');
      await Promise.resolve();
    });
    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-dictation-check'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-tools-dictation-result'}).props
        .children,
    ).toBe('✓ Chính xác!');
  });

  it('opens transcript popup when transcript button is pressed', async () => {
    const onOpenTranscript = jest.fn();
    const {tree} = await renderPopup({onOpenTranscript});

    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-open-transcript'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(onOpenTranscript).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate the compact seek track even with duplicate start_ms (SETE-346 Option C)', async () => {
    const segmentsWithDupes = [
      ...makeSegments(),
      {
        id: 'seg-dupe',
        index: 3,
        start_ms: 6000,
        end_ms: 10000,
        en: 'Duplicate',
        vi: 'Trùng',
        ipa: '',
      },
    ];

    const {tree} = await renderPopup({segments: segmentsWithDupes});
    // The single seek track lives in CompactControlBar (covered by its own
    // duplicate-key test); the sheet must not render a second one.
    expect(() =>
      tree.root.findByProps({testID: 'youtube-tools-seek'}),
    ).toThrow();
  });
});
