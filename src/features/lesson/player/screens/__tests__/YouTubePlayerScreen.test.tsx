import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {LessonSnapshot} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

let playerMountCount = 0;
let lastPlayerOnError: ((code: string) => void) | undefined;

jest.mock('../../components/YouTubePlayer', () => {
  const {View} = require('react-native');
  const MockPlayer = ({onError}: {onError?: (code: string) => void}) => {
    playerMountCount += 1;
    lastPlayerOnError = onError;
    return <View testID="mock-youtube-player" />;
  };
  return {
    __esModule: true,
    YouTubePlayer: MockPlayer,
    YOUTUBE_PLAYER_ERROR_CODES: {
      VIDEO_NOT_FOUND: 'YOUTUBE_VIDEO_NOT_FOUND',
      EMBED_NOT_ALLOWED: 'YOUTUBE_NOT_EMBEDDABLE',
    },
  };
});

jest.spyOn(React, 'lazy').mockImplementation(() => {
  const {YouTubePlayer} = require('../../components/YouTubePlayer');
  return YouTubePlayer;
});

const {CanonicalLessonPlayerScreen} = require('../CanonicalLessonPlayerScreen');

const LESSON_ID = '33333333-3333-4333-8333-333333333301';

const youtubeSnapshot: LessonSnapshot = {
  id: LESSON_ID,
  slug: 'yt',
  title: 'YouTube lesson',
  description: '',
  origin: 'learner',
  source_type: 'youtube',
  content_revision: 1,
  unit: null,
  youtube: {video_id: 'abc123', duration_ms: 120000},
  sentences: [
    {
      id: '11111111-1111-4111-8111-111111111101',
      position: 0,
      text_en: 'Hello.',
      text_vi: 'Xin chào.',
      ipa: 'həˈloʊ',
      start_ms: 0,
      end_ms: 2000,
    },
  ],
  blocks: [],
  analyses: {},
};

let mockState: {status: string; [key: string]: unknown} = {
  status: 'ready',
  snapshot: youtubeSnapshot,
  offline: false,
  hasUpdate: false,
};

jest.mock('../../logic/useCanonicalLesson', () => ({
  useCanonicalLesson: () => ({
    state: mockState,
    open: jest.fn(),
    checkForUpdate: jest.fn(),
    requestAnalysis: jest.fn(),
  }),
}));

jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));

async function renderScreen() {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <CanonicalLessonPlayerScreen
            navigation={navigation as never}
            route={{params: {lessonId: LESSON_ID}} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

/** Five timed sentences and four words: enough for the practice run. */
const PRACTICE_LINES = [
  ['I wake up at six.', 'Tôi thức dậy lúc sáu giờ.'],
  ['Then I drink coffee.', 'Sau đó tôi uống cà phê.'],
  ['She reads a book.', 'Cô ấy đọc một cuốn sách.'],
  ['We walk to the park.', 'Chúng tôi đi bộ đến công viên.'],
  ['They play football.', 'Họ chơi bóng đá.'],
] as const;
const PRACTICE_WORDS = [
  ['coffee', 'cà phê'],
  ['book', 'cuốn sách'],
  ['park', 'công viên'],
  ['football', 'bóng đá'],
] as const;
const practiceSnapshot: LessonSnapshot = {
  ...youtubeSnapshot,
  sentences: PRACTICE_LINES.map(([en, vi], index) => ({
    id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
    position: index,
    text_en: en,
    text_vi: vi,
    ipa: 'ə',
    start_ms: index * 2000,
    end_ms: index * 2000 + 1500,
  })),
  lesson_items: PRACTICE_WORDS.map(([text, meaningVi], index) => ({
    role: 'required',
    introduction: 'new',
    position: index,
    item: {
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
      code: `word:${text}`,
      kind: 'word',
      text,
      meaning_vi: meaningVi,
      ipa: null,
      part_of_speech: null,
      note_vi: null,
      audience: 'all',
      payload: {},
      audio: null,
      image: null,
      examples: [],
      variants: [],
      errors: [],
    },
  })),
} as LessonSnapshot;

describe('CanonicalLessonPlayerScreen YouTube study', () => {
  beforeEach(() => {
    playerMountCount = 0;
    lastPlayerOnError = undefined;
    mockState = {
      status: 'ready',
      snapshot: youtubeSnapshot,
      offline: false,
      hasUpdate: false,
    };
  });

  it('mounts the study layout for a YouTube snapshot (AC-011)', async () => {
    const tree = await renderScreen();
    expect(tree.root.findByProps({testID: 'canonical-player'})).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'youtube-sentence-indicator'}),
    ).toBeDefined();
  });

  it('remounts the player when retry is pressed after unavailable (AC-011 S2)', async () => {
    const tree = await renderScreen();
    await act(async () => {
      lastPlayerOnError?.('YOUTUBE_VIDEO_NOT_FOUND');
    });
    expect(
      tree.root.findByProps({testID: 'youtube-timeline-unavailable'}),
    ).toBeDefined();
    const retry = tree.root.findByProps({testID: 'youtube-video-retry'});
    await act(async () => {
      retry.props.onPress();
    });
    expect(playerMountCount).toBeGreaterThanOrEqual(2);
  });

  it('offers the practice run in the header of a ready YouTube lesson', async () => {
    mockState = {
      status: 'ready',
      snapshot: practiceSnapshot,
      offline: false,
      hasUpdate: false,
    };
    const tree = await renderScreen();
    const practice = tree.root.findAll(
      node =>
        node.props.testID === 'canonical-youtube-practice' &&
        typeof node.props.onPress === 'function',
    )[0];
    expect(practice).toBeDefined();
    expect(practice!.props.accessibilityLabel).toBe('Bắt đầu luyện');
  });

  it('shows no practice button when the lesson is too small to practise', async () => {
    const tree = await renderScreen();
    expect(
      tree.root.findAll(
        node => node.props.testID === 'canonical-youtube-practice',
      ),
    ).toHaveLength(0);
  });

  it('shows offline and update banners (AC-011 S3)', async () => {
    mockState = {
      status: 'ready',
      snapshot: youtubeSnapshot,
      offline: true,
      hasUpdate: true,
    };
    const tree = await renderScreen();
    expect(
      tree.root.findByProps({testID: 'canonical-player-offline'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'canonical-player-update'}),
    ).toBeDefined();
  });
});
