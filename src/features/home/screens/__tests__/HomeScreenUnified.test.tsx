import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {trackEvent} from '@features/analytics';
import {getGamificationSnapshot} from '@features/engagement';

import {AppThemeProvider} from '@ui/theme';

import * as AuthSession from '@core/auth/authSession';
import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {FeatureFlagProvider} from '@core/release';
import {recordLessonEvent} from '@core/sync/lessonProgress';

import {mockAppNavigation} from '@test/support';
import {seedCanonicalLessonDownload} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {HomeScreen} from '../HomeScreen';

jest.mock('react-native-reanimated', () => {
  const base = require('../../../../../test-utils/reanimatedMock');
  return {
    ...base,
    withRepeat: (anim: unknown) => anim,
  };
});

jest.mock('@features/engagement', () => ({
  getGamificationSnapshot: jest.fn(() => ({
    currentStreak: 0,
    weeklyGoal: {completedThisWeek: 0, target: 6},
    badges: [],
  })),
}));

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
}));

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

const SEEDED_LESSON_ID = '33333333-3333-4333-8333-333333333301';

function catalogLesson(index: number) {
  const id = `33333333-3333-4333-8333-3333333333${String(index).padStart(
    2,
    '0',
  )}`;
  return {
    id,
    title: `Canonical ${index}`,
    description: index === 32 ? '' : `Lesson ${index} description`,
    origin: 'admin',
    source_type: 'admin_text',
    content_revision: 1,
    sentence_count: index,
    youtube_video_id: null,
    unit: null,
    updated_at: '2026-09-30T04:15:00.000Z',
  };
}

const CATALOG_PAGE = {
  contract_version: 1,
  lessons: [31, 32, 33, 34, 35, 36, 37, 38].map(catalogLesson),
  next_cursor: null,
};

const CONTINUE_NULL = {
  request_id: 'req-continue-null',
  status: 'success',
  progress: null,
};

function catalogResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => CATALOG_PAGE,
  };
}

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const mockTrackEvent = trackEvent as jest.Mock;

function navigation() {
  return {
    navigate: jest.fn(),
    getParent: () => ({
      navigate: jest.fn(),
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
});

async function renderHome(nav = navigation()) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={{
          releaseName: 'test-unified',
          features: {},
        }}
      >
        <AppThemeProvider>
          <HomeScreen navigation={nav as never} route={{} as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  activeRenderers.push(tree);
  return {tree, nav};
}

function railPressables(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    node =>
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('home-recent-item-') &&
      typeof node.props.onPress === 'function',
  );
}

describe('HomeScreen unified rail (LING-179 TASK-001)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.clearAllMocks();
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
    mockFetch.mockImplementation(async (url: string) =>
      String(url).includes('/api/v1/lessons')
        ? catalogResponse()
        : {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => CONTINUE_NULL,
          },
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the rail from canonical catalog summaries with no local lessons', async () => {
    const {tree} = await renderHome();
    expect(
      tree.root.findByProps({
        testID: 'home-recent-item-33333333-3333-4333-8333-333333333331',
      }),
    ).toBeDefined();
  });

  it('caps the rail at three lessons', async () => {
    const {tree} = await renderHome();
    expect(railPressables(tree)).toHaveLength(3);
    expect(() =>
      tree.root.findByProps({
        testID: 'home-recent-item-33333333-3333-4333-8333-333333333334',
      }),
    ).toThrow();
  });

  it('shows the reading type label for catalog items without minutes', async () => {
    const {tree} = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Đọc');
  });

  it('opens the canonical player and tracks the open', async () => {
    const {tree, nav} = await renderHome();
    const target = tree.root
      .findAll(
        node =>
          node.props.testID ===
          'home-recent-item-33333333-3333-4333-8333-333333333331',
      )
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for canonical rail item');
    await act(async () => {
      target.props.onPress();
    });
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333331',
    );
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('unified_lesson_opened', {
      lesson_id: '33333333-3333-4333-8333-333333333331',
      source: 'home_rail',
    });
  });

  it('prefers downloaded lessons over the catalog fallback', async () => {
    seedCanonicalLessonDownload();
    const {tree} = await renderHome();
    expect(
      tree.root.findByProps({
        testID: `home-recent-item-${SEEDED_LESSON_ID}`,
      }),
    ).toBeDefined();
    expect(railPressables(tree)).toHaveLength(1);
  });

  it('opens the downloaded lesson from the Continue action', async () => {
    seedCanonicalLessonDownload();
    // F5: Home reads the started lesson from local lesson_progress.
    recordLessonEvent({lessonId: SEEDED_LESSON_ID, event: 'start'});
    const {tree, nav} = await renderHome();
    const target = tree.root
      .findAll(node => node.props.testID === 'home-continue-action')
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for continue action');
    await act(async () => {
      target.props.onPress();
    });
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith(SEEDED_LESSON_ID);
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('routes home-starter-pick to Today and keeps its Vietnamese label', async () => {
    seedCanonicalLessonDownload();
    const {tree, nav} = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Chọn bài để học');
    const target = tree.root
      .findAll(node => node.props.testID === 'home-starter-pick')
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for home-starter-pick');
    await act(async () => {
      target.props.onPress();
    });
    expect(mockAppNavigation.openToday).toHaveBeenCalledTimes(1);
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('shows in-progress weekly goal copy from the snapshot (AC-001 S1)', async () => {
    (getGamificationSnapshot as jest.Mock).mockReturnValue({
      currentStreak: 0,
      weeklyGoal: {completedThisWeek: 4, target: 6},
      badges: [],
    });
    const {tree} = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('4 trên 6 bài đã xong');
    expect(text).not.toContain('67%');
    expect(text).toContain('Thêm 2 bài để nhận huy hiệu Chăm chỉ.');
  });
});
