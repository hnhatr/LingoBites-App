import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';
const saveLesson = (_args: unknown) => ({ok: true, lessonId: 'l1'});
import {AppThemeProvider} from '@ui/theme';

import {validFullOutput, validMinimalOutput} from '@core/fixtures';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {HomeScreen} from '../HomeScreen';

// The video card shares the Create tab's gate: `youtubeLearning` flag AND
// the server YouTube capability.
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

function renderHomeYouTubeReady(nav = navigation()) {
  mockYouTubeServerEnabled = true;
  return renderHome(
    nav,
    makeTestReleaseConfig({...CORE_WITH_REVIEW, youtubeLearning: true}),
  );
}

function seedLesson() {
  const lesson = saveLesson({
    confirmedText: validFullOutput.original_text,
    sourceType: 'paste_text',
    lesson: validFullOutput,
  });
  if (!lesson.ok) throw new Error('Could not seed lesson');
}

function seedMinimalLesson() {
  const lesson = saveLesson({
    confirmedText: validMinimalOutput.original_text,
    sourceType: 'paste_text',
    lesson: validMinimalOutput,
  });
  if (!lesson.ok) throw new Error('Could not seed minimal lesson');
}

async function pressCell(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  const target = tree.root
    .findAll(node => node.props.testID === testID)
    .find(node => typeof node.props.onPress === 'function');
  if (!target) throw new Error(`No pressable found for testID ${testID}`);
  await act(async () => target.props.onPress());
}

const CELLS = [
  'home-explore-video',
  'home-explore-news',
  'home-explore-offline',
  'home-explore-practice',
];

// The three non-video cells keep the temporary Lessons destination (HVB-02:
// the video card must never share their destination).
const LEGACY_CELLS = CELLS.filter(testID => testID !== 'home-explore-video');

describe('HomeScreen explore grid (SETE-279)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.clearAllMocks();
    mockYouTubeServerEnabled = false;
  });

  it('renders the section title and all four cells', async () => {
    seedLesson();
    const tree = await renderHome();
    expect(
      tree.root.findAll(node => node.props.testID === 'home-explore-section')
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({children: 'Bạn muốn học gì?'}).length,
    ).toBeGreaterThan(0);
    for (const testID of CELLS) {
      expect(
        tree.root.findAll(node => node.props.testID === testID).length,
      ).toBeGreaterThan(0);
    }
  });

  it('routes the three non-video cells to the Lessons tab (temporary destination)', async () => {
    seedLesson();
    for (const testID of LEGACY_CELLS) {
      const tabNavigate = jest.fn();
      const tree = await renderHome(navigation(tabNavigate));
      await pressCell(tree, testID);
      expect(tabNavigate).toHaveBeenCalledWith('Lessons');
    }
  });

  it('routes "view all" to the Lessons tab', async () => {
    seedLesson();
    const tabNavigate = jest.fn();
    const tree = await renderHome(navigation(tabNavigate));
    await pressCell(tree, 'home-explore-view-all');
    expect(tabNavigate).toHaveBeenCalledWith('Lessons');
  });

  it('shows the grid even with no lessons (never a dead end)', async () => {
    seedMinimalLesson();
    const tree = await renderHome();
    for (const testID of CELLS) {
      expect(
        tree.root.findAll(node => node.props.testID === testID).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe('HomeScreen video card (LING-176 TASK-008)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.clearAllMocks();
    mockYouTubeServerEnabled = false;
  });

  function videoPressable(tree: ReactTestRenderer.ReactTestRenderer) {
    const target = tree.root
      .findAll(node => node.props.testID === 'home-explore-video')
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for home-explore-video');
    return target;
  }

  it('disables the card when the server YouTube capability is off', async () => {
    seedLesson();
    const tree = await renderHome(
      navigation(),
      makeTestReleaseConfig({...CORE_WITH_REVIEW, youtubeLearning: true}),
    );
    const cell = videoPressable(tree);

    expect(cell.props.disabled).toBe(true);
    expect(cell.props.accessibilityState).toEqual({disabled: true});
  });

  it('disables the card when the youtubeLearning flag is off', async () => {
    seedLesson();
    mockYouTubeServerEnabled = true;
    const tree = await renderHome();
    const cell = videoPressable(tree);

    expect(cell.props.disabled).toBe(true);
    expect(cell.props.accessibilityState).toEqual({disabled: true});
  });

  it('opens the Create tab when flag and server agree', async () => {
    seedLesson();
    const tabNavigate = jest.fn();
    const tree = await renderHomeYouTubeReady(navigation(tabNavigate));

    await pressCell(tree, 'home-explore-video');

    expect(tabNavigate).toHaveBeenCalledWith('Create');
    expect(tabNavigate).not.toHaveBeenCalledWith('Lessons', expect.anything());
  });
});

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

  it('renders the card between explore and the lessons rail (FR-001)', async () => {
    seedLesson();
    const tree = await renderHome();
    const ids = orderedTestIds(tree);
    const explore = ids.indexOf('home-explore-section');
    const card = ids.indexOf('home-weekly-goal-card');
    const lessons = ids.indexOf('home-lessons-section');
    expect(explore).toBeGreaterThanOrEqual(0);
    expect(card).toBeGreaterThan(explore);
    expect(lessons).toBeGreaterThan(card);
  });

  it('shows the empty-week copy and is not tappable (AC-001 S2 / A-005)', async () => {
    seedLesson();
    const tree = await renderHome();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('0 trên 6 bài đã xong');
    expect(text).toContain('Thêm 6 bài để nhận huy hiệu Chăm chỉ.');
    const card = tree.root.findByProps({testID: 'home-weekly-goal-card'});
    expect(card.props.onPress).toBeUndefined();
    expect(card.props.accessibilityRole).toBe('summary');
  });
});
