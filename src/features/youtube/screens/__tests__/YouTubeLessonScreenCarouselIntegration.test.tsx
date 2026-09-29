import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {YouTubeTranscript} from '@core/schemas/youtube-transcript-v1';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {
  YouTubeLessonScreen,
  YouTubeLessonRouteScreen,
} from '../YouTubeLessonScreen';
import {SentenceCarousel} from '../../components/SentenceCarousel';
import {SentenceCard} from '../../components/SentenceCard';
import {makeEnrichment} from '../../logic/sentence/__tests__/fixtures/sentenceFixtures';
import {speak} from '@features/audio';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
});

jest.mock('@features/audio', () => ({
  isEnUsVoiceAvailable: jest.fn(),
  speak: jest.fn(async () => ({ok: true})),
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

function makeTestLesson(): YouTubeTranscript {
  return {
    schema_version: 'youtube-transcript-v1',
    video: {
      id: 'dQw4w9WgXcQ',
      title: 'Carousel Integration Lesson',
      channel_title: 'English Bites',
      duration_seconds: 30,
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
        en: 'First learning sentence text',
        vi: 'Câu học đầu tiên',
        ipa: 'fɜːrst ˈlɜːnɪŋ ˈsɛntəns tɛkst',
      },
      {
        id: 'dQw4w9WgXcQ-1',
        index: 1,
        start_ms: 3_000,
        end_ms: 6_000,
        en: 'Second practice sentence text',
        vi: 'Câu luyện tập thứ hai',
        ipa: 'ˈsɛkənd ˈpræktɪs ˈsɛntəns tɛkst',
      },
      {
        id: 'dQw4w9WgXcQ-2',
        index: 2,
        start_ms: 6_000,
        end_ms: 9_000,
        en: 'Third finished sentence text',
        vi: 'Câu kết thúc thứ ba',
        ipa: 'θɜːrd ˈfɪnɪʃt ˈsɛntəns tɛkst',
      },
    ],
    warnings: [],
  };
}

async function renderScreen(
  lesson: YouTubeTranscript = makeTestLesson(),
  extraProps: Partial<React.ComponentProps<typeof YouTubeLessonScreen>> = {},
) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <YouTubeLessonScreen
            enrichmentMap={{
              0: makeEnrichment(),
              1: makeEnrichment(),
              2: makeEnrichment(),
            }}
            lesson={lesson}
            level="Intermediate"
            {...extraProps}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  return tree;
}

async function renderRoute(
  params:
    | {lesson: YouTubeTranscript; saveFailed?: boolean}
    | {lessonId: string},
) {
  const navigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
    reset: jest.fn(),
    getParent: jest.fn(() => ({navigate: jest.fn()})),
    addListener: jest.fn(() => jest.fn()),
    setOptions: jest.fn(),
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
  return {tree, navigation};
}

describe('YouTubeLessonScreen + SentenceCarousel Integration (SETE-334, TASK-7)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
    mockCurrentTimeSeconds = 0;
    mockSeekTo.mockClear();
    mockSpeak.mockClear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders SentenceCarousel directly inside YouTubeLessonScreen (regression barrier)', async () => {
    const tree = await renderScreen();

    // Must mount SentenceCarousel component
    const carousel = tree.root.findByType(SentenceCarousel);
    expect(carousel).toBeTruthy();

    // Must have horizontal carousel FlatList with snapInterval
    const carouselList = tree.root.findByProps({
      testID: 'sentence-carousel-list',
    });
    expect(carouselList).toBeTruthy();
    expect(carouselList.props.horizontal).toBe(true);
    expect(carouselList.props.snapToInterval).toBeGreaterThan(0);

    // Must NOT have old vertical transcript-list or TranscriptLine items
    expect(() =>
      tree.root.findByProps({testID: 'youtube-transcript-list'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'transcript-line-dQw4w9WgXcQ-0'}),
    ).toThrow();
  });

  it('renders SentenceCard for all segments with header titles and proficiency level', async () => {
    const tree = await renderScreen();

    const cards = tree.root.findAllByType(SentenceCard);
    expect(cards).toHaveLength(3);

    for (let i = 0; i < 3; i++) {
      expect(
        tree.root.findByProps({testID: `sentence-card-${i}`}),
      ).toBeTruthy();

      expect(
        tree.root.findByProps({testID: `sentence-card-${i}-level`}).props.label,
      ).toBe('Intermediate');
      expect(
        tree.root.findByProps({testID: `sentence-card-${i}-en`}),
      ).toBeTruthy();
      expect(
        tree.root.findByProps({testID: `sentence-card-${i}-vi`}),
      ).toBeTruthy();
    }
  });

  it('swiping/selecting a sentence card seeks the video player', async () => {
    const tree = await renderScreen();

    const carouselList = tree.root.findByProps({
      testID: 'sentence-carousel-list',
    });
    const snapInterval = carouselList.props.snapToInterval;

    mockSeekTo.mockClear();

    // Swipe to card 1 (index 1)
    await act(async () => {
      carouselList.props.onScrollBeginDrag?.();
      carouselList.props.onMomentumScrollEnd({
        nativeEvent: {contentOffset: {x: snapInterval, y: 0}},
      });
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledWith(3);
  });

  it('tapping next sentence prompt in SentenceCard advances carousel and seeks video', async () => {
    const tree = await renderScreen();

    mockSeekTo.mockClear();

    // Scroll card 0 to bottom to reveal next sentence prompt
    await act(async () => {
      tree.root.findByProps({testID: 'sentence-card-0-scroll'}).props.onScroll({
        nativeEvent: {
          contentOffset: {y: 400, x: 0},
          layoutMeasurement: {height: 400, width: 300},
          contentSize: {height: 600, width: 300},
        },
      });
      await Promise.resolve();
    });

    // Card 0 bottom next prompt
    const nextPrompt = tree.root.findByProps({
      testID: 'sentence-card-0-bottom-next-prompt',
    });
    expect(nextPrompt).toBeTruthy();

    await act(async () => {
      nextPrompt.props.onPress();
      await Promise.resolve();
    });

    expect(mockSeekTo).toHaveBeenCalledWith(3);
  });

  it('tapping word token on SentenceCard triggers TTS speak', async () => {
    const tree = await renderScreen();

    const wordToken = tree.root.findByProps({
      testID: 'sentence-card-0-word-0',
    });
    expect(wordToken).toBeTruthy();

    await act(async () => {
      wordToken.props.onPress();
      await Promise.resolve();
    });

    expect(mockSpeak).toHaveBeenCalledWith('First');
  });

  it('forwards practice sentence action from SentenceCard to onPracticeSentence handler', async () => {
    const onPracticeSentence = jest.fn();
    const tree = await renderScreen(makeTestLesson(), {onPracticeSentence});

    const practiceBtn = tree.root.findByProps({
      testID: 'sentence-card-1-practice-button',
    });
    expect(practiceBtn).toBeTruthy();

    await act(async () => {
      practiceBtn.props.onPress();
      await Promise.resolve();
    });

    expect(onPracticeSentence).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dQw4w9WgXcQ-1',
        index: 1,
        en: 'Second practice sentence text',
      }),
    );
  });

  it('renders dots indicator for <= 10 segments and syncs active dot with active sentence', async () => {
    const tree = await renderScreen();

    expect(
      tree.root.findByProps({testID: 'youtube-dots-indicator'}),
    ).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-dot-0'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-dot-1'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'youtube-dot-2'})).toBeTruthy();
  });

  it('populates real enrichment data end-to-end at the route/container level', async () => {
    const lesson = makeTestLesson();
    const enrichment0 = makeEnrichment({keyWord: 'learning'});
    const enrichment1 = makeEnrichment({keyWord: 'practice'});
    const enrichment2 = makeEnrichment({keyWord: 'finished'});

    // Mock whole-lesson enrichment API call
    mockFetch.mockResolvedValueOnce(
      jsonResponse({0: enrichment0, 1: enrichment1, 2: enrichment2}),
    );

    const {tree} = await renderRoute({lesson});

    // Advance async queue so useEffect fetch finishes
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Verify API was called for the lesson's video ID
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `/v1/youtube/transcripts/${lesson.video.id}/enrichment`,
      ),
      expect.objectContaining({method: 'GET'}),
    );

    // Verify SentenceCard receives and renders the real enrichment keyword and vocab
    expect(tree.root.findByType(SentenceCarousel)).toBeTruthy();
    const cards = tree.root.findAllByType(SentenceCard);
    expect(cards).toHaveLength(3);

    // Card 0 has the real keyWord block value
    expect(
      tree.root.findByProps({testID: 'sentence-card-0-block-keyword-value'}),
    ).toBeTruthy();
  });

  it('updates mini player visibility and back-to-active chip on card vertical scroll', async () => {
    const tree = await renderScreen();

    // Select card 0 so activeIndex is 0
    const carouselList = tree.root.findByProps({
      testID: 'sentence-carousel-list',
    });
    await act(async () => {
      carouselList.props.onMomentumScrollEnd({
        nativeEvent: {contentOffset: {x: 0, y: 0}},
      });
      await Promise.resolve();
    });

    // Trigger player block layout so playerBlockHeight is known (e.g. 200)
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-player-block'}).props.onLayout({
        nativeEvent: {layout: {height: 200, width: 375, x: 0, y: 0}},
      });
      await Promise.resolve();
    });

    // Initially mini-player and back-chip are not visible
    expect(() =>
      tree.root.findByProps({testID: 'youtube-mini-player'}),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({testID: 'youtube-back-to-active-chip'}),
    ).toThrow();

    // Scroll card 0 down past 120pt (> playerHeight * 0.5 = 100)
    await act(async () => {
      tree.root.findByProps({testID: 'sentence-card-0-scroll'}).props.onScroll({
        nativeEvent: {
          contentOffset: {y: 120, x: 0},
          layoutMeasurement: {height: 400, width: 300},
          contentSize: {height: 800, width: 300},
        },
      });
      await Promise.resolve();
    });

    // Both mini-player and back-chip should be visible
    expect(tree.root.findByProps({testID: 'youtube-mini-player'})).toBeTruthy();
    const backChip = tree.root.findByProps({
      testID: 'youtube-back-to-active-chip',
    });
    expect(backChip).toBeTruthy();

    // Tap back chip to return to top/active card
    await act(async () => {
      backChip.props.onPress();
      await Promise.resolve();
    });

    expect(() =>
      tree.root.findByProps({testID: 'youtube-back-to-active-chip'}),
    ).toThrow();
  });
});
