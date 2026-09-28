import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {DB_NAME} from '@shared/db/constants';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {getYouTubeProgress, saveYouTubeProgress} from '../../youtubeQueryPort';
import {saveYouTubeLesson} from '../../youtubeQueryPort';
import type {YouTubeTranscript} from '@shared/schemas/youtube-transcript-v1';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {
  YouTubeLessonRouteScreen,
  YouTubeLessonScreen,
} from '../YouTubeLessonScreen';
import {YouTubeTranscriptPopup} from '../YouTubeTranscriptPopup';
import {TranscriptLine} from '../../components/TranscriptLine';
import {speak} from '@modules/audio';

jest.mock('@modules/audio', () => ({
  isEnUsVoiceAvailable: jest.fn(),
  speak: jest.fn(),
  stop: jest.fn(),
}));

const mockSpeak = speak as jest.Mock;

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

function makeLesson(): YouTubeTranscript {
  return {
    schema_version: 'youtube-transcript-v1',
    video: {
      id: 'dQw4w9WgXcQ',
      title: 'Sample video',
      channel_title: 'Sample channel',
      duration_seconds: 20,
      language: 'en',
      embeddable: true,
    },
    transcript_source: 'auto_caption',
    segments: [
      {
        id: 'dQw4w9WgXcQ-0',
        index: 0,
        start_ms: 0,
        end_ms: 3_000,
        en: 'First sentence',
        vi: 'Câu đầu tiên',
        ipa: 'fɜːrst ˈsɛntəns',
      },
      {
        id: 'dQw4w9WgXcQ-1',
        index: 1,
        start_ms: 3_000,
        end_ms: 6_000,
        en: 'Second sentence',
        vi: 'Câu thứ hai',
        ipa: 'ˈsɛkənd ˈsɛntəns',
      },
      {
        id: 'dQw4w9WgXcQ-2',
        index: 2,
        start_ms: 6_000,
        end_ms: 9_000,
        en: 'Third sentence',
        vi: 'Câu thứ ba',
        ipa: 'θɜːrd ˈsɛntəns',
      },
    ],
    warnings: [],
  };
}

async function openToolsPopup(tree: renderer.ReactTestRenderer) {
  await act(async () => {
    tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
    await Promise.resolve();
  });
}

async function renderScreen(
  lesson: YouTubeTranscript = makeLesson(),
  extraProps: Partial<React.ComponentProps<typeof YouTubeLessonScreen>> = {},
) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <YouTubeLessonScreen lesson={lesson} {...extraProps} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  return tree;
}

describe('YouTubeLessonScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
    mockCurrentTimeSeconds = 0;
    mockSeekTo.mockClear();
    mockSpeak.mockClear();
    mockSpeak.mockResolvedValue({ok: true});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders header with single-line title truncation (SETE-339)', async () => {
    const tree = await renderScreen();
    const header = tree.root.findByType(ScreenHeader);
    expect(header.props.titleNumberOfLines).toBe(1);
    expect(header.props.title).toBe('Sample video');
  });

  it('renders sentence cards with English and Vietnamese for segments', async () => {
    const tree = await renderScreen();

    for (let i = 0; i < 3; i++) {
      expect(
        tree.root.findByProps({testID: `sentence-card-${i}-en`}).props.children,
      ).toBeTruthy();
      expect(
        tree.root.findByProps({testID: `sentence-card-${i}-vi`}).props.children,
      ).toBeTruthy();
    }
  });

  it('selecting a card seeks the player to that segment start, in seconds', async () => {
    const tree = await renderScreen();

    const flatList = tree.root.findByProps({testID: 'sentence-carousel-list'});
    const snapInterval = flatList.props.snapToInterval;
    await act(async () => {
      flatList.props.onScrollBeginDrag?.();
      flatList.props.onMomentumScrollEnd({
        nativeEvent: {contentOffset: {x: snapInterval, y: 0}},
      });
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledWith(3);
  });

  it('speaks the tapped word via TTS (SETE-325, C-2)', async () => {
    const tree = await renderScreen();

    await act(async () => {
      tree.root.findByProps({testID: 'sentence-card-1-word-0'}).props.onPress();
      await Promise.resolve();
    });

    expect(mockSpeak).toHaveBeenCalledWith('Second');
  });

  it('alerts the service message when TTS fails (SETE-325, C-2)', async () => {
    mockSpeak.mockResolvedValue({
      ok: false,
      errorCode: 'VOICE_UNAVAILABLE',
      message: 'missing voice',
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const tree = await renderScreen();

      await act(async () => {
        tree.root
          .findByProps({testID: 'sentence-card-1-word-0'})
          .props.onPress();
        await Promise.resolve();
      });

      expect(alertSpy).toHaveBeenCalledWith(expect.anything(), 'missing voice');
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('forwards per-sentence practice taps (SETE-325, C-3)', async () => {
    const onPracticeSentence = jest.fn();
    const tree = await renderScreen(makeLesson(), {onPracticeSentence});

    await act(async () => {
      tree.root
        .findByProps({testID: 'sentence-card-2-practice-button'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(onPracticeSentence).toHaveBeenCalledWith(
      expect.objectContaining({id: 'dQw4w9WgXcQ-2'}),
    );
  });

  it('keeps exactly 3 header controls and no overflow menu (SETE-346)', async () => {
    const tree = await renderScreen();

    expect(
      tree.root.findByProps({testID: 'youtube-toggle-vietnamese'}),
    ).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-toggle-ipa'})).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-start-practice'}),
    ).toBeTruthy();
    expect(() =>
      tree.root.findByProps({testID: 'youtube-more-options'}),
    ).toThrow();
  });

  it('opens the transcript popup from the Tools sheet and seeks without closing (SETE-325, C-4; SETE-346)', async () => {
    const tree = await renderScreen();

    expect(tree.root.findByType(YouTubeTranscriptPopup).props.visible).toBe(
      false,
    );
    await openToolsPopup(tree);
    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-open-transcript'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findByType(YouTubeTranscriptPopup).props.visible).toBe(
      true,
    );
    const popupLines = tree.root
      .findAllByType(TranscriptLine)
      .filter(node =>
        String(node.props.testID).startsWith('youtube-popup-line-'),
      );
    expect(popupLines).toHaveLength(3);

    mockSeekTo.mockClear();
    await act(async () => {
      popupLines[2].props.onPress(makeLesson().segments[2]);
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledWith(6);
    expect(tree.root.findByType(YouTubeTranscriptPopup).props.visible).toBe(
      true,
    );

    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-transcript-popup-close'})
        .props.onPress();
      await Promise.resolve();
    });
    expect(tree.root.findByType(YouTubeTranscriptPopup).props.visible).toBe(
      false,
    );
  });

  it('toggles Vietnamese and IPA display independently', async () => {
    const tree = await renderScreen();

    expect(tree.root.findByProps({testID: 'sentence-card-0-vi'})).toBeTruthy();

    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-toggle-vietnamese'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(() =>
      tree.root.findByProps({testID: 'sentence-card-0-vi'}),
    ).toThrow();

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-toggle-ipa'}).props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-toggle-ipa'}).props.tone,
    ).toBe('surface');
  });

  it('follows and re-seeks the active sentence while infinite loop is on (SETE-346)', async () => {
    const tree = await renderScreen();

    mockCurrentTimeSeconds = 0.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    await openToolsPopup(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-inf'}).props.onPress();
      await Promise.resolve();
    });

    mockSeekTo.mockClear();

    mockCurrentTimeSeconds = 3.5;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledWith(0);
  });

  it('loops the active sentence the specified count and then advances without infinite re-renders (SETE-341)', async () => {
    const tree = await renderScreen();

    // Initial position at sentence 0
    mockCurrentTimeSeconds = 0.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    // Open tools popup and select 3 loops
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-close'}).props.onPress();
      await Promise.resolve();
    });

    mockSeekTo.mockClear();

    // Transition 1: play to sentence 1 (3.5s) -> loop 1 triggers seek back to 0
    mockCurrentTimeSeconds = 3.5;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(
      tree.root
        .findByProps({testID: 'youtube-toast-message'})
        .findByProps({variant: 'label'}).props.children,
    ).toBe('Lặp câu 1 · còn 2 lần');

    // Simulate replay of sentence 0
    mockSeekTo.mockClear();
    mockCurrentTimeSeconds = 0.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(mockSeekTo).not.toHaveBeenCalled();

    // Transition 2: play to sentence 1 again -> loop 2 triggers seek back to 0
    mockCurrentTimeSeconds = 3.5;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(
      tree.root
        .findByProps({testID: 'youtube-toast-message'})
        .findByProps({variant: 'label'}).props.children,
    ).toBe('Lặp câu 1 · còn 1 lần');

    // Simulate replay of sentence 0 for 3rd time
    mockSeekTo.mockClear();
    mockCurrentTimeSeconds = 0.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(mockSeekTo).not.toHaveBeenCalled();

    // Transition 3: play to sentence 1 again -> loop count exhausted, advances to sentence 1
    mockCurrentTimeSeconds = 3.5;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('loops infinitely when loopCount is Infinity without runaway re-renders (SETE-341)', async () => {
    const tree = await renderScreen();

    // Initial position at sentence 0
    mockCurrentTimeSeconds = 0.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    // Open tools popup and select infinite loop
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-inf'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-close'}).props.onPress();
      await Promise.resolve();
    });

    mockSeekTo.mockClear();

    // Advance to sentence 1 -> triggers infinite loop seek back to sentence 0
    mockCurrentTimeSeconds = 3.5;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(
      tree.root
        .findByProps({testID: 'youtube-toast-message'})
        .findByProps({variant: 'label'}).props.children,
    ).toBe('Lặp vô hạn câu hiện tại');
  });

  it('repeats sentence N>=1 exactly without cascading back to sentence 0 (SETE-345)', async () => {
    const tree = await renderScreen();

    // Settle on sentence 1.
    mockCurrentTimeSeconds = 3.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    // Arm loop 3.
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-close'}).props.onPress();
      await Promise.resolve();
    });

    mockSeekTo.mockClear();

    // Sentence 1 ends -> advance to sentence 2 -> loop replays sentence 1.
    mockCurrentTimeSeconds = 6.5;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    // Exact replay to sentence 1 start (3.0s, never 2.7s into sentence 0).
    expect(mockSeekTo).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(3);

    // The mocked player now reports the exact replay position (seekTo
    // writes it back): no cascade seek towards sentence 0 follows.
    mockSeekTo.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('allows manual seek during loop mode without triggering loop ping-pong (SETE-341)', async () => {
    const tree = await renderScreen();

    // Initial position at sentence 0
    mockCurrentTimeSeconds = 0.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    // Open tools popup and select 3 loops
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-compact-tools'}).props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-loop-3'}).props.onPress();
      await Promise.resolve();
    });

    mockSeekTo.mockClear();

    // User navigates to next sentence via the carousel a11y controls
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-carousel-next'}).props.onPress();
      await Promise.resolve();
    });

    // Should seek to sentence 1 start exactly (3.0s, no compensation while
    // loop is armed — SETE-345) exactly once
    expect(mockSeekTo).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(3);

    // Close tools popup
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-close'}).props.onPress();
      await Promise.resolve();
    });

    // No infinite loop re-renders triggered
    mockSeekTo.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('passes playback rate to the iframe via the Tools sheet (SETE-346)', async () => {
    const tree = await renderScreen();

    expect(
      tree.root.findByProps({testID: 'youtube-iframe'}).props.playbackRate,
    ).toBe(1);

    await openToolsPopup(tree);
    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-tools-speed-1.25'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-iframe'}).props.playbackRate,
    ).toBe(1.25);
  });

  it('loops between A and B segment markers set from the Tools sheet (SETE-346)', async () => {
    const tree = await renderScreen();

    mockCurrentTimeSeconds = 0.1;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    await openToolsPopup(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-a'}).props.onPress();
      await Promise.resolve();
    });

    mockCurrentTimeSeconds = 3.5;
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-tools-ab-b'}).props.onPress();
      await Promise.resolve();
    });

    mockSeekTo.mockClear();
    mockCurrentTimeSeconds = 6.5;

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(
      tree.root.findByProps({testID: 'youtube-ab-loop-status'}),
    ).toBeTruthy();
  });

  it('shows an inline error when the player reports a playback error', async () => {
    const tree = await renderScreen();

    const iframe = tree.root.findByProps({testID: 'youtube-iframe'});
    await act(async () => {
      iframe.props.onError('embed_not_allowed');
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-player-error'}),
    ).toBeTruthy();
  });

  it('enters offline reading mode with the full cached transcript when the player errors', async () => {
    const tree = await renderScreen();

    const iframe = tree.root.findByProps({testID: 'youtube-iframe'});
    await act(async () => {
      iframe.props.onError('embed_not_allowed');
      await Promise.resolve();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-offline-banner'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'youtube-player-error'}),
    ).toBeTruthy();

    for (let i = 0; i < 3; i++) {
      expect(
        tree.root.findByProps({testID: `sentence-card-${i}-en`}),
      ).toBeTruthy();
      expect(
        tree.root.findByProps({testID: `sentence-card-${i}-vi`}),
      ).toBeTruthy();
    }
  });

  it('disables Tools sheet playback controls in offline reading mode (SETE-346)', async () => {
    const tree = await renderScreen();

    const iframe = tree.root.findByProps({testID: 'youtube-iframe'});
    await act(async () => {
      iframe.props.onError('video_not_found');
      await Promise.resolve();
    });

    await openToolsPopup(tree);
    for (const testID of [
      'youtube-tools-speed-1',
      'youtube-tools-loop-1',
      'youtube-tools-ab-a',
      'youtube-tools-ab-b',
    ]) {
      expect(tree.root.findByProps({testID}).props.disabled).toBe(true);
    }
    // Reading the transcript needs no player, so it stays enabled.
    expect(
      tree.root.findByProps({testID: 'youtube-tools-open-transcript'}),
    ).toBeTruthy();
  });

  it('disables VI/IPA toggles when their content is empty (SETE-290)', async () => {
    const lesson = makeLesson();
    const empty = {
      ...lesson,
      segments: lesson.segments.map(segment => ({
        ...segment,
        vi: '',
        ipa: '',
      })),
    };
    const tree = await renderScreen(empty);

    expect(
      tree.root.findByProps({testID: 'youtube-toggle-vietnamese'}).props
        .disabled,
    ).toBe(true);
    expect(
      tree.root.findByProps({testID: 'youtube-toggle-ipa'}).props.disabled,
    ).toBe(true);
  });

  it('shows lesson warnings when the payload carries them (SETE-290)', async () => {
    const tree = await renderScreen({
      ...makeLesson(),
      warnings: ['partial audio'],
    });

    expect(
      tree.root.findByProps({testID: 'youtube-lesson-warnings'}),
    ).toBeTruthy();
  });

  it('shows no warnings banner for a clean lesson', async () => {
    const tree = await renderScreen();

    expect(() =>
      tree.root.findByProps({testID: 'youtube-lesson-warnings'}),
    ).toThrow();
  });
});

describe('YouTubeLessonRouteScreen save warning (SETE-283, HVB-07)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderRoute(params: unknown, navigationOverrides = {}) {
    const tabNavigate = jest.fn();
    const navigation: {
      goBack: jest.Mock;
      navigate: jest.Mock;
      reset: jest.Mock;
      getParent: jest.Mock;
      addListener: jest.Mock;
    } = {
      goBack: jest.fn(),
      navigate: jest.fn(),
      reset: jest.fn(),
      getParent: jest.fn(() => ({navigate: tabNavigate})),
      addListener: jest.fn(() => jest.fn()),
      ...navigationOverrides,
    };
    const route = {key: 'YouTubeLesson', name: 'YouTubeLesson', params};
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <YouTubeLessonRouteScreen
              navigation={navigation as never}
              route={route as never}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
      await Promise.resolve();
    });
    return {tree, navigation, tabNavigate};
  }

  function pressRouteBack(tree: renderer.ReactTestRenderer) {
    const header = tree.root.findByType(ScreenHeader);
    if (typeof header.props.onBack !== 'function') {
      throw new Error('No route back handler');
    }
    return act(async () => {
      header.props.onBack();
      await Promise.resolve();
    });
  }

  it('warns that the lesson was not saved when saveFailed is set', async () => {
    const {tree} = await renderRoute({lesson: makeLesson(), saveFailed: true});

    expect(
      tree.root.findByProps({testID: 'youtube-lesson-save-warning'}),
    ).toBeTruthy();
    // The lesson itself still opens — content is not blocked.
    expect(
      tree.root.findByProps({testID: 'sentence-carousel-list'}),
    ).toBeTruthy();
  });

  it('shows no warning for a normally saved lesson', async () => {
    const {tree} = await renderRoute({lesson: makeLesson()});

    expect(() =>
      tree.root.findByProps({testID: 'youtube-lesson-save-warning'}),
    ).toThrow();
    expect(
      tree.root.findByProps({testID: 'sentence-carousel-list'}),
    ).toBeTruthy();
  });

  it('exits a fresh lesson to Home, never back to the URL input (SETE-290)', async () => {
    const {tree, navigation, tabNavigate} = await renderRoute({
      lesson: makeLesson(),
    });

    await pressRouteBack(tree);

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'CreateMain'}],
    });
    expect(tabNavigate).toHaveBeenCalledWith('Home');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('intercepts system Back on a fresh lesson and exits to Home (SETE-290)', async () => {
    const {navigation, tabNavigate} = await renderRoute({
      lesson: makeLesson(),
    });

    expect(navigation.addListener).toHaveBeenCalledWith(
      'beforeRemove',
      expect.any(Function),
    );
    const listener = navigation.addListener.mock.calls[0]?.[1] as
      | ((event: {
          data: {action: {type: string}};
          preventDefault: () => void;
        }) => void)
      | undefined;
    if (!listener) throw new Error('beforeRemove listener not registered');
    const preventDefault = jest.fn();
    listener({data: {action: {type: 'POP'}}, preventDefault});

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'CreateMain'}],
    });
    expect(tabNavigate).toHaveBeenCalledWith('Home');
  });

  it('keeps plain goBack for a saved lesson (SETE-289 preserved)', async () => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
    expect(saveYouTubeLesson({lesson: makeLesson()}).ok).toBe(true);

    const {tree, navigation} = await renderRoute({lessonId: 'dQw4w9WgXcQ'});

    expect(
      tree.root.findByProps({testID: 'sentence-carousel-list'}),
    ).toBeTruthy();
    await pressRouteBack(tree);

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('opens SpeakingRoom with the tapped sentence via the tab parent (SETE-325, C-3)', async () => {
    const {tree, tabNavigate} = await renderRoute({lesson: makeLesson()});

    await act(async () => {
      tree.root
        .findByProps({testID: 'sentence-card-0-practice-button'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(tabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'SpeakingRoom',
      params: {sentenceText: 'First sentence'},
    });
  });

  it('falls back to Tabs > Lessons > SpeakingRoom from History (SETE-325, C-3)', async () => {
    const rootNavigate = jest.fn();
    const {tree} = await renderRoute(
      {lesson: makeLesson()},
      {
        getParent: jest.fn(() => ({
          getState: () => ({
            routeNames: ['Tabs', 'YouTubeHistory', 'YouTubeLesson'],
          }),
          navigate: rootNavigate,
        })),
      },
    );

    await act(async () => {
      tree.root
        .findByProps({testID: 'sentence-card-1-practice-button'})
        .props.onPress();
      await Promise.resolve();
    });

    expect(rootNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'Lessons',
      params: {
        screen: 'SpeakingRoom',
        params: {sentenceText: 'Second sentence'},
      },
    });
  });
});

describe('YouTubeLessonScreen resume (SETE-290 DEV-3)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
    mockCurrentTimeSeconds = 0;
    mockSeekTo.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('seeks to the saved position on ready and stays paused', async () => {
    saveYouTubeProgress({
      lessonId: 'dQw4w9WgXcQ',
      positionMs: 4500,
      segmentIndex: 1,
    });
    const tree = await renderScreen();
    expect(mockSeekTo).not.toHaveBeenCalled();

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-iframe'}).props.onReady();
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledWith(4.5);
    // The contract is seek-but-paused: the user presses Play to continue.
    expect(tree.root.findByProps({testID: 'youtube-iframe'}).props.play).toBe(
      false,
    );
  });

  it('does not seek when there is no saved progress', async () => {
    const tree = await renderScreen();

    await act(async () => {
      tree.root.findByProps({testID: 'youtube-iframe'}).props.onReady();
      await Promise.resolve();
    });

    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('clears progress when the video ends so the next open starts over', async () => {
    saveYouTubeProgress({
      lessonId: 'dQw4w9WgXcQ',
      positionMs: 4500,
      segmentIndex: 1,
    });
    const tree = await renderScreen();

    await act(async () => {
      tree.root
        .findByProps({testID: 'youtube-iframe'})
        .props.onChangeState('ended');
      await Promise.resolve();
    });

    expect(getYouTubeProgress('dQw4w9WgXcQ')).toBeNull();
  });

  describe('SETE-333: Ad, Error, Offline, and Completion states', () => {
    it('handles ad playback by disabling player actions and displaying ad banner', async () => {
      const tree = await renderScreen();

      await act(async () => {
        tree.root
          .findByProps({testID: 'youtube-iframe'})
          .props.onChangeState('ad');
        await Promise.resolve();
      });

      expect(tree.root.findByProps({testID: 'youtube-ad-banner'})).toBeTruthy();
      expect(
        tree.root.findByProps({testID: 'youtube-compact-play-toggle'}).props
          .disabled,
      ).toBe(true);

      // Transitioning back to playing clears ad banner
      await act(async () => {
        tree.root
          .findByProps({testID: 'youtube-iframe'})
          .props.onChangeState('playing');
        await Promise.resolve();
      });

      expect(() =>
        tree.root.findByProps({testID: 'youtube-ad-banner'}),
      ).toThrow();
    });

    it('displays error banner with retry and back buttons on player error', async () => {
      const onBack = jest.fn();
      const tree = await renderScreen(makeLesson(), {onBack});

      await act(async () => {
        tree.root
          .findByProps({testID: 'youtube-iframe'})
          .props.onError('video_not_found');
        await Promise.resolve();
      });

      expect(
        tree.root.findByProps({testID: 'youtube-player-error-banner'}),
      ).toBeTruthy();

      const backBtn = tree.root.findByProps({
        testID: 'youtube-error-back-to-list',
      });
      expect(backBtn).toBeTruthy();
      act(() => {
        backBtn.props.onPress();
      });
      expect(onBack).toHaveBeenCalled();
    });

    it('shows completed banner when playback ends with replay, practice all, and next lesson actions', async () => {
      const onStartPractice = jest.fn();
      const onBack = jest.fn();
      const tree = await renderScreen(makeLesson(), {
        onStartPractice,
        onBack,
      });

      await act(async () => {
        tree.root
          .findByProps({testID: 'youtube-iframe'})
          .props.onChangeState('ended');
        await Promise.resolve();
      });

      expect(
        tree.root.findByProps({testID: 'youtube-lesson-completed-actions'}),
      ).toBeTruthy();

      const replayBtn = tree.root.findByProps({
        testID: 'youtube-completed-replay',
      });
      const practiceBtn = tree.root.findByProps({
        testID: 'youtube-completed-practice',
      });
      const nextBtn = tree.root.findByProps({
        testID: 'youtube-completed-next-lesson',
      });

      expect(replayBtn).toBeTruthy();
      expect(practiceBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();

      act(() => {
        practiceBtn.props.onPress();
      });
      expect(onStartPractice).toHaveBeenCalledTimes(1);

      act(() => {
        nextBtn.props.onPress();
      });
      expect(onBack).toHaveBeenCalled();
    });
  });
});
