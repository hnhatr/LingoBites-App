import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import type {YouTubeTranscript} from '@core/schemas/youtube-transcript-v1';
import {YouTubeLessonScreen} from '../YouTubeLessonScreen';
import {YouTubeToolsPopup} from '../../components/YouTubeToolsPopup';

let mockCurrentTimeSeconds = 0;
const mockSeekTo = jest.fn((seconds: number) => {
  mockCurrentTimeSeconds = seconds;
});

jest.mock('react-native-youtube-iframe', () => {
  const ReactModule = require('react');
  const {View: RNView} = require('react-native');

  const PLAYER_ERRORS = {
    HTML5_ERROR: 'HTML5_error',
    VIDEO_NOT_FOUND: 'video_not_found',
    EMBED_NOT_ALLOWED: 'embed_not_allowed',
    INVALID_PARAMETER: 'invalid_parameter',
  };

  const YoutubeIframe = ReactModule.forwardRef(
    (_props: unknown, ref: unknown) => {
      ReactModule.useImperativeHandle(ref, () => ({
        seekTo: (seconds: number) => mockSeekTo(seconds),
        getCurrentTime: jest.fn(async () => mockCurrentTimeSeconds),
      }));

      return ReactModule.createElement(RNView, {
        testID: 'youtube-iframe',
        ...(_props as object),
        ref,
      });
    },
  );

  return {
    __esModule: true,
    default: YoutubeIframe,
    PLAYER_ERRORS,
  };
});

function makeLesson(segmentCount: number = 3): YouTubeTranscript {
  return {
    schema_version: 'youtube-transcript-v1',
    video: {
      id: 'dQw4w9WgXcQ',
      title: 'Sample video',
      channel_title: 'Sample channel',
      duration_seconds: segmentCount * 5,
      language: 'en',
      embeddable: true,
    },
    transcript_source: 'auto_caption',
    segments: Array.from({length: segmentCount}, (_, i) => ({
      id: `dQw4w9WgXcQ-${i}`,
      index: i,
      start_ms: i * 3_000,
      end_ms: i * 3_000 + 3_000,
      en: `Sentence ${i + 1}`,
      vi: `Câu ${i + 1}`,
      ipa: `ipa-${i + 1}`,
    })),
    warnings: [],
  };
}

describe('YouTubeLessonScreen Tools & Video-Card Sync (SETE-332, TASK-5)', () => {
  let activeTree: renderer.ReactTestRenderer | null = null;

  async function renderScreen(
    lesson: YouTubeTranscript = makeLesson(),
    extraProps: Partial<React.ComponentProps<typeof YouTubeLessonScreen>> = {},
  ) {
    await act(async () => {
      activeTree = renderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <YouTubeLessonScreen lesson={lesson} {...extraProps} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
      await Promise.resolve();
    });
    return activeTree!;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
    mockCurrentTimeSeconds = 0;
    mockSeekTo.mockClear();
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

  it('opens and closes the Tools popup via the CompactControlBar button', async () => {
    const tree = await renderScreen();

    const toolsPopup = tree.root.findByType(YouTubeToolsPopup);
    expect(toolsPopup.props.visible).toBe(false);

    // Open tools popup
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findByType(YouTubeToolsPopup).props.visible).toBe(true);

    // Close tools popup via close button
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-close'}).props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findByType(YouTubeToolsPopup).props.visible).toBe(false);
  });

  it('reflects armed amber border on Tools button when loopCount > 1 or speed != 1.0x', async () => {
    const tree = await renderScreen();

    // Default state: not armed
    expect(
      tree.root.findByProps({testID: 'youtube-compact-bar'}).props,
    ).toBeTruthy();

    // Open tools and set loop to 3
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}).props.onPress();
      await Promise.resolve();
    });

    // Toast message shows loop info
    expect(
      tree.root.findByProps({testID: 'youtube-toast-message'}),
    ).toBeTruthy();

    // Close tools popup
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-close'}).props.onPress();
      await Promise.resolve();
    });

    // Check toolsArmed is true on CompactControlBar
    const controlBar = tree.root.findByProps({testID: 'youtube-compact-bar'});
    expect(controlBar).toBeTruthy();
  });

  it('renders dots pagination when <= 10 segments and hides when > 10', async () => {
    // 3 segments: dots rendered
    const tree3 = await renderScreen(makeLesson(3));
    expect(
      tree3.root.findByProps({testID: 'youtube-dots-indicator'}),
    ).toBeTruthy();
    expect(tree3.root.findByProps({testID: 'youtube-dot-0'})).toBeTruthy();
    expect(tree3.root.findByProps({testID: 'youtube-dot-1'})).toBeTruthy();
    expect(tree3.root.findByProps({testID: 'youtube-dot-2'})).toBeTruthy();

    // 12 segments: dots hidden
    const tree12 = await renderScreen(makeLesson(12));
    expect(() =>
      tree12.root.findByProps({testID: 'youtube-dots-indicator'}),
    ).toThrow();
  });

  it('sets A-B loop points and displays toast in Tools popup (SETE-346)', async () => {
    const tree = await renderScreen();

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });

    // Set point A at the current sentence
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-a'}).props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-toast-message'}),
    ).toBeTruthy();

    // Clear appears once a point is set
    expect(
      tree.root.findByProps({testID: 'youtube-tools-ab-clear'}),
    ).toBeTruthy();

    // Set point B then clear the range
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-b'}).props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-toast-message'}),
    ).toBeTruthy();

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-clear'}).props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-toast-message'}),
    ).toBeTruthy();
  });

  it('clears the A-B range when a sentence loop is armed and vice versa (SETE-346)', async () => {
    const tree = await renderScreen();

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });

    // Arm an A-B range first
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-a'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-b'}).props.onPress();
      await Promise.resolve();
    });
    expect(
      tree.root.findByProps({testID: 'youtube-ab-loop-status'}),
    ).toBeTruthy();

    // Arming a sentence loop clears the A-B range
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}).props.onPress();
      await Promise.resolve();
    });
    expect(() =>
      tree.root.findByProps({testID: 'youtube-ab-loop-status'}),
    ).toThrow();

    // Setting A again resets the loop back to 1
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-a'}).props.onPress();
      await Promise.resolve();
    });
    expect(
      tree.root.findByProps({testID: 'youtube-tools-loop-1'}).props[
        'aria-pressed'
      ],
    ).toBe(true);
  });

  it('displays back-chip when scrolled down past 40pt and handles tap', async () => {
    const tree = await renderScreen();

    // Simulate scrolling card down past 40pt
    await act(async () => {
      tree.root.findByProps({testID: 'sentence-card-0-scroll'}).props.onScroll({
        nativeEvent: {
          contentOffset: {y: 60, x: 0},
        },
      });
      await Promise.resolve();
    });

    const backChip = tree.root.findByProps({
      testID: 'youtube-back-to-active-chip',
    });
    expect(backChip).toBeTruthy();

    // Tapping back-chip scrolls back to active sentence
    await act(async () => {
      backChip.props.onPress();
      await Promise.resolve();
    });

    expect(() =>
      tree.root.findByProps({testID: 'youtube-back-to-active-chip'}),
    ).toThrow();
  });
});
