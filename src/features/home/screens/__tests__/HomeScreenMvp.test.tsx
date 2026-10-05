import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';
import {AppThemeProvider} from '@ui/theme';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {HomeScreen} from '../HomeScreen';

let mockYouTubeServerEnabled = false;

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

function navigation(tabNavigate = jest.fn(), rootNavigate = jest.fn()) {
  return {
    navigate: jest.fn(),
    getParent: () => ({
      navigate: tabNavigate,
      getParent: () => ({navigate: rootNavigate}),
    }),
    rootNavigate,
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

async function renderHome(
  nav = navigation(),
  releaseConfig = makeTestReleaseConfig(CORE_WITH_REVIEW),
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={releaseConfig}>
        <AppThemeProvider>
          <HomeScreen navigation={nav as never} route={{} as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  activeRenderers.push(tree);
  return tree;
}

/**
 * HomeScreen weekly goal card (TC-4B / LING-232)
 *
 * Section order (mockup v4, AC-1): hero → weekly goal → shortcuts → saved.
 * The legacy explore-grid and video-card describe blocks are removed (LING-261
 * Gap 1): the explore grid no longer renders.
 */
describe('HomeScreen weekly goal card (TC-4B / LING-232)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.clearAllMocks();
    mockYouTubeServerEnabled = false;
  });

  function orderedTestIds(tree: ReactTestRenderer.ReactTestRenderer): string[] {
    return tree.root
      .findAll(node => typeof node.props.testID === 'string')
      .map(node => String(node.props.testID));
  }

  it('renders the weekly goal card after the hero and before the shortcuts (v4 order, AC-1)', async () => {
    const tree = await renderHome();
    const ids = orderedTestIds(tree);
    // Find first hero testID (e.g. home-hero-youtube_disabled)
    const hero = ids.findIndex(id => id.startsWith('home-hero-'));
    const card = ids.indexOf('home-weekly-goal-card');
    const shortcuts = ids.indexOf('home-shortcuts-grid');
    expect(hero).toBeGreaterThanOrEqual(0);
    expect(card).toBeGreaterThan(hero);
    expect(shortcuts).toBeGreaterThan(card);
  });

  it('shows the empty-week copy and is not tappable (AC-001 S2 / A-005)', async () => {
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('0 trên 6 bài đã xong');
    expect(text).toContain('Thêm 6 bài để nhận huy hiệu Chăm chỉ.');
    const card = tree.root.findByProps({testID: 'home-weekly-goal-card'});
    expect(card.props.onPress).toBeUndefined();
    expect(card.props.accessibilityRole).toBe('summary');
  });

  it('does not render the legacy explore grid (Gap 1 removed)', async () => {
    const tree = await renderHome();
    expect(
      tree.root.findAll(node => node.props.testID === 'home-explore-section')
        .length,
    ).toBe(0);
    // None of the old explore cell IDs should exist
    for (const id of [
      'home-explore-video',
      'home-explore-news',
      'home-explore-offline',
      'home-explore-practice',
    ]) {
      expect(
        tree.root.findAll(node => node.props.testID === id).length,
      ).toBe(0);
    }
  });
});
