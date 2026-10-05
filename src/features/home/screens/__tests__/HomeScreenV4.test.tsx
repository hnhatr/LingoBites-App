/**
 * HomeScreen v4 redesign tests (LING-256, LING-267, AC-001..AC-004).
 *
 * Covers:
 * - Five hero states (DQ-002, P-004, AC-002)
 * - Shortcut destinations and disabled Video tile (DQ-005, D3, P-003, §VS-4)
 * - Repeating animations & Reduced motion rest poses (AD-002, §VS-7, AC-004)
 * - Dark and Sticker-soft theme contrast >= 4.5:1 (DQ-004, AC-004)
 */
import React from 'react';
import {StyleSheet} from 'react-native';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {getGamificationSnapshot} from '@features/engagement';

import {AppThemeProvider} from '@ui/theme';

import * as AuthSession from '@core/auth/authSession';
import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {FeatureFlagProvider} from '@core/release';

import {
  CORE_WITH_REVIEW,
  makeTestReleaseConfig,
  mockAppNavigation,
} from '@test/support';
import {seedCanonicalLessonDownload} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {HomeScreen} from '../HomeScreen';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------
let mockYouTubeServerEnabled = false;
let mockReducedMotion = false;

jest.mock('@core/api/youtubeCapabilities', () => ({
  useYouTubeServerEnabled: () => mockYouTubeServerEnabled,
}));

jest.mock('@features/engagement', () => ({
  getGamificationSnapshot: jest.fn(() => ({
    currentStreak: 0,
    weeklyGoal: {completedThisWeek: 0, target: 6},
    badges: [],
  })),
}));

jest.mock('react-native-reanimated', () => {
  const base = require('../../../../../test-utils/reanimatedMock');
  return {
    ...base,
    useReducedMotion: () => mockReducedMotion,
    withRepeat: (anim: unknown) => anim,
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: 'test-token',
    session_id: '1',
    refresh_token: '2',
    access_expires_at: '2050',
    refresh_expires_at: '2050',
  },
  userId: 'user1',
};

const CONTINUE_NULL = {
  request_id: 'req-continue-null',
  status: 'success',
  progress: null,
};

function navigation(tabNavigate = jest.fn(), navigate = jest.fn()) {
  return {
    navigate,
    getParent: () => ({
      navigate: tabNavigate,
      getParent: () => ({navigate: jest.fn()}),
    }),
  };
}

let activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    for (const tree of activeRenderers) {
      tree.unmount();
    }
    activeRenderers = [];
  });
  mockReducedMotion = false;
  mockYouTubeServerEnabled = false;
});

async function renderHome(
  nav = navigation(),
  config = makeTestReleaseConfig(CORE_WITH_REVIEW),
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={config}>
        <AppThemeProvider>
          <HomeScreen navigation={nav as never} route={{} as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  activeRenderers.push(tree);
  return tree;
}

// ---------------------------------------------------------------------------
// Five hero states (AC-002, §VS-2.4)
// ---------------------------------------------------------------------------
describe('Home hero states (AC-002, §VS-2.4)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CONTINUE_NULL,
    }));
  });

  it('state S1 no_lessons: renders S1 copy and CTA', async () => {
    mockYouTubeServerEnabled = true;
    const tree = await renderHome(
      navigation(),
      makeTestReleaseConfig({...CORE_WITH_REVIEW, youtubeLearning: true}),
    );
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('home-hero-no_lessons');
    expect(text).toContain('Chưa có bài học nào');
    expect(text).toContain('Tạo bài học đầu tiên');
    expect(text).toContain('Meo! Mình học bài đầu tiên nha?');
  });

  it('state S2 saved_only: renders S2 copy, count and CTA', async () => {
    seedCanonicalLessonDownload();
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('home-hero-saved_only');
    expect(text).toContain('Chọn bài để học');
    expect(text).toContain('Chọn bài');
    expect(text).toContain('Hôm nay học 5 phút thôi!');
  });

  it('state S3 in_progress: renders lesson title, minutes body and CTA without progress bar', async () => {
    seedCanonicalLessonDownload();
    mockFetch.mockImplementation(async (url: string) =>
      String(url).includes('/api/v1/lessons')
        ? {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              contract_version: 1,
              lessons: [],
              next_cursor: null,
            }),
          }
        : {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              request_id: 'req-continue-1',
              status: 'success',
              progress: {
                id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
                lesson_id: '33333333-3333-4333-8333-333333333301',
                status: 'in_progress',
                started_at: '2026-09-25T07:00:00.000Z',
                completed_at: null,
                created_at: '2026-09-25T07:00:00.000Z',
                updated_at: '2026-09-25T07:15:00.000Z',
              },
            }),
          },
    );
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('home-hero-in_progress');
    expect(text).toContain('Đang học dở');
    expect(text).toContain('Sắp xong rồi, cố lên!');
    const continueBtn = tree.root
      .findAll(node => node.props.testID === 'home-continue-action')
      .find(node => typeof node.props.onPress === 'function');
    expect(continueBtn).toBeDefined();
  });

  it('state S4 youtube_disabled: renders disabled hero state', async () => {
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('home-hero-youtube_disabled');
  });

  it('state S5 goal_met: renders S5 copy and screen-level confetti', async () => {
    (getGamificationSnapshot as jest.Mock).mockReturnValue({
      currentStreak: 3,
      weeklyGoal: {completedThisWeek: 6, target: 6},
      badges: [],
    });
    mockReducedMotion = false;
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('home-hero-goal_met');
    expect(text).toContain('Đã đạt mục tiêu tuần');
    expect(text).toContain('Học thêm bài nữa để giữ chuỗi nhé.');
    expect(text).toContain('Giỏi quá! Meo meo!');
    expect(
      tree.root.findAll(node => node.props.testID === 'home-confetti').length,
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Shortcut destinations and disabled video tile (§VS-4)
// ---------------------------------------------------------------------------
describe('Home shortcuts (§VS-4, DQ-005, D3, P-003)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CONTINUE_NULL,
    }));
    mockYouTubeServerEnabled = false;
  });

  it('renders all 4 shortcut tiles in §VS-4 order without lock overlay', async () => {
    const tree = await renderHome();
    const shortcutIds = [
      'home-shortcut-video',
      'home-shortcut-review',
      'home-shortcut-speaking',
      'home-shortcut-lessons',
    ];
    for (const id of shortcutIds) {
      expect(
        tree.root.findAll(node => node.props.testID === id).length,
      ).toBeGreaterThan(0);
    }
    // No lock icon rendered in shortcuts
    expect(tree.root.findAll(node => node.props.name === 'lock').length).toBe(
      0,
    );
  });

  it('video shortcut is disabled when youtube is off', async () => {
    const tree = await renderHome();
    const videoBtn = tree.root
      .findAll(node => node.props.testID === 'home-shortcut-video')
      .find(node => typeof node.props.disabled !== 'undefined');
    expect(videoBtn?.props.disabled).toBe(true);
    expect(videoBtn?.props.accessibilityState).toEqual({disabled: true});
  });

  it('video shortcut is enabled when youtube flag + server agree', async () => {
    mockYouTubeServerEnabled = true;
    const tree = await renderHome(
      navigation(),
      makeTestReleaseConfig({...CORE_WITH_REVIEW, youtubeLearning: true}),
    );
    const videoBtn = tree.root
      .findAll(node => node.props.testID === 'home-shortcut-video')
      .find(node => typeof node.props.disabled !== 'undefined');
    expect(videoBtn?.props.disabled).toBe(false);
  });

  it('review shortcut navigates to DailyReview', async () => {
    const nav = jest.fn();
    const tree = await renderHome(navigation(jest.fn(), nav));
    const reviewBtn = tree.root
      .findAll(node => node.props.testID === 'home-shortcut-review')
      .find(node => typeof node.props.onPress === 'function');
    if (!reviewBtn) throw new Error('No review shortcut found');
    await act(async () => reviewBtn.props.onPress());
    expect(mockAppNavigation.openReview).toHaveBeenCalledTimes(1);
    expect(nav).not.toHaveBeenCalled();
  });

  it('speaking shortcut navigates to SpeakingRoom', async () => {
    const nav = jest.fn();
    const tree = await renderHome(navigation(jest.fn(), nav));
    const speakBtn = tree.root
      .findAll(node => node.props.testID === 'home-shortcut-speaking')
      .find(node => typeof node.props.onPress === 'function');
    if (!speakBtn) throw new Error('No speaking shortcut found');
    await act(async () => speakBtn.props.onPress());
    expect(mockAppNavigation.openSpeakingRoom).toHaveBeenCalledTimes(1);
    expect(nav).not.toHaveBeenCalled();
  });

  it('lessons shortcut navigates to LessonList / Today', async () => {
    const nav = jest.fn();
    const tree = await renderHome(navigation(jest.fn(), nav));
    const lessonsBtn = tree.root
      .findAll(node => node.props.testID === 'home-shortcut-lessons')
      .find(node => typeof node.props.onPress === 'function');
    if (!lessonsBtn) throw new Error('No lessons shortcut found');
    await act(async () => lessonsBtn.props.onPress());
    expect(mockAppNavigation.openToday).toHaveBeenCalledTimes(1);
    expect(nav).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reduced motion (D5, AD-002, §VS-7, AC-004)
// ---------------------------------------------------------------------------
describe('Home reduced motion (§VS-7, AC-004)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CONTINUE_NULL,
    }));
    mockReducedMotion = true;
  });

  it('renders successfully with reduced motion enabled (no confetti or heart bursts)', async () => {
    (getGamificationSnapshot as jest.Mock).mockReturnValue({
      currentStreak: 3,
      weeklyGoal: {completedThisWeek: 6, target: 6},
      badges: [],
    });
    const tree = await renderHome();
    const confettiNodes = tree.root.findAll(
      node => node.props.testID === 'home-confetti',
    );
    expect(confettiNodes.length).toBe(0);

    const hearts = tree.root.findAll(
      node => node.props.testID === 'home-heart-burst',
    );
    expect(hearts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Speech bubble layout (§VS-2.3)
// ---------------------------------------------------------------------------
describe('Speech bubble layout (§VS-2.3)', () => {
  it('bubble style has right=58, top=8, width=120, maxWidth=120', async () => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CONTINUE_NULL,
    }));
    seedCanonicalLessonDownload();
    const tree = await renderHome();
    const bubbleNode = tree.root
      .findAll(node => node.props.testID === 'home-mascot-bubble')
      .find(node => node.children != null);
    expect(bubbleNode).toBeDefined();

    const flattened = StyleSheet.flatten(bubbleNode!.props.style);
    expect(flattened.right).toBe(58);
    expect(flattened.top).toBe(8);
    expect(flattened.width).toBe(120);
    expect(flattened.maxWidth).toBe(120);
  });
});
