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

let mockLessonCapabilities = {
  catalog: false,
  canonicalDelivery: false,
  aiMaterialization: false,
  packagedImport: false,
  partialRetry: false,
  privateLibrary: false,
};

jest.mock('@features/lesson/player', () => {
  const actual = jest.requireActual('@features/lesson/player');
  return {
    ...actual,
    useLessonServerCapabilities: () => mockLessonCapabilities,
  };
});

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

function renderHomeUnifiedReady(nav = navigation()) {
  mockLessonCapabilities = {
    catalog: true,
    canonicalDelivery: true,
    aiMaterialization: true,
    packagedImport: true,
    partialRetry: true,
    privateLibrary: true,
  };
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
    mockLessonCapabilities = {
      catalog: false,
      canonicalDelivery: false,
      aiMaterialization: false,
      packagedImport: false,
      partialRetry: false,
      privateLibrary: false,
    };
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
    mockLessonCapabilities = {
      catalog: false,
      canonicalDelivery: false,
      aiMaterialization: false,
      packagedImport: false,
      partialRetry: false,
      privateLibrary: false,
    };
  });

  function videoPressable(tree: ReactTestRenderer.ReactTestRenderer) {
    const target = tree.root
      .findAll(node => node.props.testID === 'home-explore-video')
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for home-explore-video');
    return target;
  }

  it('disables the card when unified catalog is not ready', async () => {
    seedLesson();
    const tree = await renderHome();
    const cell = videoPressable(tree);

    expect(cell.props.disabled).toBe(true);
    expect(cell.props.accessibilityState).toEqual({disabled: true});
  });

  it('opens LessonCreation on the Lessons tab when unified mode is ready', async () => {
    seedLesson();
    const tabNavigate = jest.fn();
    const tree = await renderHomeUnifiedReady(navigation(tabNavigate));

    await pressCell(tree, 'home-explore-video');

    expect(tabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'LessonCreation',
      params: expect.objectContaining({
        initialSource: 'youtube',
        submissionId: expect.stringMatching(/^home-youtube-/),
      }),
    });
  });
});
