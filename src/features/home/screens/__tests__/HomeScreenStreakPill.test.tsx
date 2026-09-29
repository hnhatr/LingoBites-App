import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@core/release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@test/support';
import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {AppThemeProvider} from '@ui/theme';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {startReviewSession} from '../../../engagement/logic/reviewSession';

const mockListYouTubeLessons = jest.fn(() => []);
const mockCountYoutubeLessons = jest.fn(() => 0);

jest.mock('@features/youtube', () => ({
  listYouTubeLessons: (...args: unknown[]) =>
    mockListYouTubeLessons.apply(undefined, args),
  countYouTubeLessons: (...args: unknown[]) =>
    mockCountYoutubeLessons.apply(undefined, args),
}));

import {HomeScreen} from '../HomeScreen';

const EXPLORE_IDS = [
  'home-explore-video',
  'home-explore-news',
  'home-explore-offline',
  'home-explore-practice',
];

function navigation() {
  return {
    navigate: jest.fn(),
    getParent: () => ({
      navigate: jest.fn(),
      // SETE-289: HomeScreen resolves the RootStack through the tab parent
      // on every render.
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

async function renderHome() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <HomeScreen navigation={navigation() as never} route={{} as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  activeRenderers.push(tree);
  return tree;
}

// Seeds one real completed review session "today" so the snapshot derives a
// streak of 1 from the persisted event log — no mocks, same path as the app.
function seedOneSessionToday() {
  const now = new Date().toISOString();
  const session = startReviewSession();
  session.record({
    flashcardId: 'streak-pill-seed-card',
    rating: 'remembered',
    dueAt: now,
    reviewedAt: now,
  });
  const outcome = session.finish(now);
  if (!outcome?.ok) throw new Error('Could not seed review session');
}

describe('HomeScreen streak pill + explore slots (SETE-311 Option B)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('hides the streak pill when there is no streak', async () => {
    const tree = await renderHome();
    expect(
      tree.root.findAll(node => node.props.testID === 'home-streak-pill')
        .length,
    ).toBe(0);
  });

  it('shows the real streak count with an accessible label', async () => {
    seedOneSessionToday();
    const tree = await renderHome();
    const pill = tree.root.findByProps({testID: 'home-streak-pill'});
    expect(pill.props.accessibilityRole).toBe('text');
    expect(pill.props.accessibilityLabel).toBe('Chuỗi 1 ngày');
    // The visible number is the real count, not a placeholder.
    expect(
      pill.findAll(node => node.props?.children === 1).length,
    ).toBeGreaterThan(0);
  });

  it('keeps the streak pill non-pressable', async () => {
    seedOneSessionToday();
    const tree = await renderHome();
    const pill = tree.root.findByProps({testID: 'home-streak-pill'});
    expect(typeof pill.props.onPress).not.toBe('function');
  });

  it('renders no badge/tag placeholders when no metric exists', async () => {
    const tree = await renderHome();
    for (const id of EXPLORE_IDS) {
      expect(
        tree.root.findAll(node => node.props.testID === `${id}-badge`).length,
      ).toBe(0);
      expect(
        tree.root.findAll(node => node.props.testID === `${id}-tag`).length,
      ).toBe(0);
    }
  });

  it('shows a decorative arrow on all four cells', async () => {
    const tree = await renderHome();
    for (const id of EXPLORE_IDS) {
      // RN's View matches twice (composite + host) — count host nodes only.
      const arrows = tree.root.findAll(
        node =>
          node.props.testID === `${id}-arrow` && typeof node.type === 'string',
      );
      expect(arrows.length).toBe(1);
      expect(arrows[0].props.accessible).toBe(false);
      expect(arrows[0].props.importantForAccessibility).toBe(
        'no-hide-descendants',
      );
    }
  });

  it('exposes exactly one button per explore cell', async () => {
    const tree = await renderHome();
    for (const id of EXPLORE_IDS) {
      const buttons = tree.root
        .findAll(node => node.props.testID === id)
        .filter(
          node =>
            typeof node.props.onPress === 'function' &&
            node.props.accessibilityRole === 'button',
        );
      expect(buttons.length).toBe(1);
    }
  });
});
