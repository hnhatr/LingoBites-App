import * as AuthSession from '@shared/auth/authSession';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {trackEvent} from '@modules/analytics';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {AppThemeProvider} from '@theme';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {HomeScreen} from '../HomeScreen';

const mockListYouTubeLessons = jest.fn();
const mockCountYoutubeLessons = jest.fn();
const mockUseYouTubeServerEnabled = jest.fn();

jest.mock('@shared/db/YoutubeLessonRepository', () => ({
  listYouTubeLessons: (...args: unknown[]) => mockListYouTubeLessons(...args),
  countYoutubeLessons: (...args: unknown[]) => mockCountYoutubeLessons(...args),
}));

jest.mock('@shared/api/youtubeCapabilities', () => ({
  useYouTubeServerEnabled: (...args: unknown[]) =>
    mockUseYouTubeServerEnabled(...args),
}));

// LING-41 TASK-006: pin the capability probe through a mutable mock so
// each test selects ready vs degraded Server behavior while the real
// `useLessonCatalog` exercises the live catalog client.
let mockLessonCapabilities = {
  catalog: true,
  canonicalDelivery: true,
  aiMaterialization: true,
  packagedImport: true,
  partialRetry: true,
  privateLibrary: true,
};

jest.mock('@modules/curriculumLesson', () => {
  const actual = jest.requireActual('@modules/curriculumLesson');
  return {
    ...actual,
    useLessonServerCapabilities: () => mockLessonCapabilities,
  };
});

jest.mock('@modules/analytics', () => ({
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

const CATALOG_PAGE = {
  request_id: 'req-home-cat',
  status: 'success',
  lessons: [
    {
      id: '00000000-0000-4000-8000-000000000021',
      title: 'Canonical one',
      description: 'First backend lesson',
      estimatedMinutes: 5,
      contentRevision: 1,
      updatedAt: '2026-09-25T10:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-000000000022',
      title: 'Canonical two',
      description: 'Second backend lesson',
      estimatedMinutes: null,
      contentRevision: 1,
      updatedAt: '2026-09-25T11:00:00.000Z',
    },
  ],
  next_cursor: null,
};

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
  // Let the catalog fetch resolve and commit.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return {tree, nav};
}

describe('HomeScreen unified rail (LING-41 TASK-006)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.clearAllMocks();
    mockListYouTubeLessons.mockReturnValue([]);
    mockCountYoutubeLessons.mockReturnValue(0);
    mockUseYouTubeServerEnabled.mockReturnValue(false);
    mockLessonCapabilities = {
      catalog: true,
      canonicalDelivery: true,
      aiMaterialization: true,
      packagedImport: true,
      partialRetry: true,
      privateLibrary: true,
    };
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CATALOG_PAGE,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the rail from backend summaries with no local lessons', async () => {
    const {tree} = await renderHome();
    expect(
      tree.root.findByProps({
        testID: 'home-recent-item-00000000-0000-4000-8000-000000000021',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        testID: 'home-recent-item-00000000-0000-4000-8000-000000000022',
      }),
    ).toBeDefined();
  });

  it('opens the canonical player and tracks the open', async () => {
    const {tree, nav} = await renderHome();
    const target = tree.root
      .findAll(
        node =>
          node.props.testID ===
          'home-recent-item-00000000-0000-4000-8000-000000000021',
      )
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for canonical rail item');
    await act(async () => {
      target.props.onPress();
    });
    expect(nav.navigate).toHaveBeenCalledWith('CurriculumLesson', {
      lessonId: '00000000-0000-4000-8000-000000000021',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('unified_lesson_opened', {
      lesson_id: '00000000-0000-4000-8000-000000000021',
      source: 'home_rail',
    });
  });

  it('disables canonical catalog when a capability is missing (fail-closed fallback)', async () => {
    mockLessonCapabilities = {
      catalog: true,
      canonicalDelivery: true,
      aiMaterialization: true,
      packagedImport: true,
      partialRetry: false,
      privateLibrary: true,
    };
    const {tree, nav} = await renderHome();
    const canonicalItems = tree.root.findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('home-recent-item-00000000-'),
    );
    expect(canonicalItems.length).toBe(0);
    expect(nav.navigate).not.toHaveBeenCalledWith(
      'CurriculumLesson',
      expect.anything(),
    );
  });
});
