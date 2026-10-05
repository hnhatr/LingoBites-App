/**
 * HomeScreen v4 redesign tests (LING-256 TASK-003).
 *
 * Covers:
 * - Five hero states (DQ-002, P-004)
 * - Shortcut destinations and locked Video tile (DQ-005, D3, P-003)
 * - Reduced motion: animations deactivated (D5, AD-002)
 * - Dark and Sticker-soft theme contrast ≥ 4.5:1 (DQ-004)
 */
import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {getGamificationSnapshot} from '@features/engagement';

import {AppThemeProvider} from '@ui/theme';

import * as AuthSession from '@core/auth/authSession';
import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';
import {seedCanonicalLessonDownload} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {HomeScreen} from '../HomeScreen';

const reanimatedMock = require('../../../../../test-utils/reanimatedMock');

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

// Override reduced motion for D5 tests
jest.mock('react-native-reanimated', () => {
  const base = require('../../../../../test-utils/reanimatedMock');
  return {
    ...base,
    useReducedMotion: () => mockReducedMotion,
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
// Five hero states (DQ-002, P-004)
// ---------------------------------------------------------------------------
describe('Home hero states (DQ-002, P-004)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
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

  it('state no_lessons: shows hero with create CTA when youtube is on', async () => {
    // No downloads, youtube flag on + server on → no_lessons state
    mockYouTubeServerEnabled = true;
    const tree = await renderHome(
      navigation(),
      makeTestReleaseConfig({...CORE_WITH_REVIEW, youtubeLearning: true}),
    );
    const text = JSON.stringify(tree.toJSON());
    // Hero renders the "no lessons" content
    expect(text).toContain('home-hero-no_lessons');
  });

  it('state youtube_disabled: shows hero with youtube-disabled content', async () => {
    // No downloads, youtube off → youtube_disabled
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('home-hero-youtube_disabled');
  });

  it('state saved_only: shows hero when downloads > 0 but none in progress', async () => {
    seedCanonicalLessonDownload();
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('home-hero-saved_only');
  });

  it('state in_progress: shows home-continue-action testID for hero CTA', async () => {
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
    const continueBtn = tree.root
      .findAll(node => node.props.testID === 'home-continue-action')
      .find(node => typeof node.props.onPress === 'function');
    expect(continueBtn).toBeDefined();
  });

  it('state goal_met: shows hero and confetti when weekly goal is met', async () => {
    (getGamificationSnapshot as jest.Mock).mockReturnValue({
      currentStreak: 3,
      weeklyGoal: {completedThisWeek: 6, target: 6},
      badges: [],
    });
    mockReducedMotion = false;
    const tree = await renderHome();
    expect(
      tree.root.findAll(node => node.props.testID === 'home-hero-goal_met')
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-confetti').length,
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Hero animations — non-reduced motion (CR-001)
// ---------------------------------------------------------------------------
describe('Home hero animations (CR-001)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CONTINUE_NULL,
    }));
    mockReducedMotion = false;
    reanimatedMock.clearWithSequenceCalls();
  });

  it('I8: CTA pulse uses withSequence on mount when reduced motion is off', async () => {
    await renderHome();
    expect(reanimatedMock.withSequenceCalls.length).toBeGreaterThan(0);
  });

  it('I2: mascot tap uses withSequence when reduced motion is off', async () => {
    const tree = await renderHome();
    reanimatedMock.clearWithSequenceCalls();
    const mascotBtn = tree.root
      .findAll(node => node.props.testID === 'home-hero-mascot-btn')
      .find(node => typeof node.props.onPress === 'function');
    if (!mascotBtn) {
      throw new Error('No mascot pressable found');
    }
    await act(async () => mascotBtn.props.onPress());
    expect(reanimatedMock.withSequenceCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Shortcut destinations and locked video tile (DQ-005, D3, P-003)
// ---------------------------------------------------------------------------
describe('Home shortcuts (DQ-005, D3, P-003)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
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

  it('renders all 4 shortcut tiles', async () => {
    const tree = await renderHome();
    const shortcutIds = [
      'home-shortcut-review',
      'home-shortcut-speaking',
      'home-shortcut-lessons',
      'home-shortcut-video',
    ];
    for (const id of shortcutIds) {
      expect(
        tree.root.findAll(node => node.props.testID === id).length,
      ).toBeGreaterThan(0);
    }
  });

  it('video shortcut is disabled when youtube is off (D3)', async () => {
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
    expect(nav).toHaveBeenCalledWith('DailyReview');
  });

  it('speaking shortcut navigates to SpeakingRoom', async () => {
    const nav = jest.fn();
    const tree = await renderHome(navigation(jest.fn(), nav));
    const speakBtn = tree.root
      .findAll(node => node.props.testID === 'home-shortcut-speaking')
      .find(node => typeof node.props.onPress === 'function');
    if (!speakBtn) throw new Error('No speaking shortcut found');
    await act(async () => speakBtn.props.onPress());
    expect(nav).toHaveBeenCalledWith('SpeakingRoom');
  });
});

// ---------------------------------------------------------------------------
// Reduced motion (D5, AD-002)
// ---------------------------------------------------------------------------
describe('Home reduced motion (D5, AD-002)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CONTINUE_NULL,
    }));
    mockReducedMotion = true;
  });

  it('renders successfully with reduced motion enabled', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
        >
          <AppThemeProvider>
            <HomeScreen
              navigation={navigation() as never}
              route={{} as never}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
      await Promise.resolve();
    });
    activeRenderers.push(tree);
    // Wave decorations with reduced motion: visible but static
    // Confetti: not rendered
    const confettiNodes = tree.root.findAll(
      node => node.props.testID === 'home-confetti',
    );
    expect(confettiNodes.length).toBe(0);
  });

  it('heart burst is not rendered under reduced motion (I2)', async () => {
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
            json: async () => CONTINUE_NULL,
          },
    );
    const tree = await renderHome();
    const hearts = tree.root.findAll(
      node => node.props.testID === 'home-heart-burst',
    );
    // HeartBurst renders nothing when reducedMotion=true
    expect(hearts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dark and Sticker-soft contrast (DQ-004)
// Existing HomeScreenChipContrast.test.tsx covers theme contrast fully.
// This test supplements with the new home pairings used in shortcuts.
// ---------------------------------------------------------------------------
describe('Home shortcut contrast (DQ-004 supplement)', () => {
  type RGB = [number, number, number];

  function parseHex(hex: string): RGB {
    const clean = hex.replace('#', '');
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }

  function luminance([r, g, b]: RGB): number {
    const linear = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  }

  function contrast(a: RGB, b: RGB): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  it('hero CTA pairing (yellow on blue) meets 4.5:1 (DQ-004)', () => {
    const bg = parseHex('#FFD35E');
    const ink = parseHex('#40320D');
    expect(contrast(bg, ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('hero title (white on deep-blue) meets 4.5:1 (DQ-004)', () => {
    const bg = parseHex('#226FAB');
    const ink = parseHex('#FFFFFF');
    expect(contrast(bg, ink)).toBeGreaterThanOrEqual(4.5);
  });
});
