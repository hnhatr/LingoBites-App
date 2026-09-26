import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@/test-support';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
const saveLesson = (_args: unknown) => ({ok: true, lessonId: 'l1'});
import {validFullOutput, validMinimalOutput} from '@shared/fixtures';
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

// SETE-290: the video cell needs the server capability too — control it
// here so navigation tests stay deterministic without network.
jest.mock('@shared/api/youtubeCapabilities', () => ({
  useYouTubeServerEnabled: (...args: unknown[]) =>
    mockUseYouTubeServerEnabled(...args),
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
  return tree;
}

function renderHomeWithYouTube(nav = navigation()) {
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
    mockListYouTubeLessons.mockReturnValue([]);
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

describe('HomeScreen video card (SETE-283)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.clearAllMocks();
    mockUseYouTubeServerEnabled.mockReturnValue(true);
    mockCountYoutubeLessons.mockReturnValue(0);
  });

  function videoPressable(tree: ReactTestRenderer.ReactTestRenderer) {
    const target = tree.root
      .findAll(node => node.props.testID === 'home-explore-video')
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for home-explore-video');
    return target;
  }

  it('disables the card with an explanation when the flag is off (HVB-03)', async () => {
    seedLesson();
    const tree = await renderHome();
    const cell = videoPressable(tree);

    expect(cell.props.disabled).toBe(true);
    expect(cell.props.accessibilityState).toEqual({disabled: true});
    expect(
      tree.root.findAllByProps({
        children: 'Tính năng đang chưa khả dụng',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('disables the card when the server capability is off even with the flag on (SETE-290)', async () => {
    seedLesson();
    mockUseYouTubeServerEnabled.mockReturnValue(false);
    const tree = await renderHomeWithYouTube();
    const cell = videoPressable(tree);

    expect(cell.props.disabled).toBe(true);
    expect(cell.props.accessibilityState).toEqual({disabled: true});
    expect(
      tree.root.findAllByProps({
        children: 'Tính năng đang chưa khả dụng',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('keeps the card enabled when saved lessons exist even if the server probe fails (SETE-345)', async () => {
    seedLesson();
    mockUseYouTubeServerEnabled.mockReturnValue(false);
    mockCountYoutubeLessons.mockReturnValue(2);
    mockListYouTubeLessons.mockReturnValue([{video: {id: 'abc123'}}]);
    const tree = await renderHomeWithYouTube();
    const cell = videoPressable(tree);

    expect(cell.props.disabled).toBe(false);
  });

  it('opens History at the root stack when saved lessons exist (HVB-01, SETE-289)', async () => {
    seedLesson();
    mockListYouTubeLessons.mockReturnValue([{video: {id: 'abc123'}}]);
    const tabNavigate = jest.fn();
    const rootNavigate = jest.fn();
    const tree = await renderHomeWithYouTube(
      navigation(tabNavigate, rootNavigate),
    );

    await pressCell(tree, 'home-explore-video');

    expect(rootNavigate).toHaveBeenCalledWith('YouTubeHistory');
    expect(tabNavigate).not.toHaveBeenCalledWith('Lessons');
  });

  it('opens Input when nothing is saved yet (HVB-01)', async () => {
    seedLesson();
    mockListYouTubeLessons.mockReturnValue([]);
    const tabNavigate = jest.fn();
    const rootNavigate = jest.fn();
    const tree = await renderHomeWithYouTube(
      navigation(tabNavigate, rootNavigate),
    );

    await pressCell(tree, 'home-explore-video');

    expect(tabNavigate).toHaveBeenCalledWith('Create', {
      screen: 'YouTubeInput',
      params: {fromHome: true},
    });
    expect(tabNavigate).not.toHaveBeenCalledWith('Lessons');
    // AC-5: the empty branch never opens History.
    expect(rootNavigate).not.toHaveBeenCalled();
  });

  it('opens History (not empty Input) when the local read fails (HVB-01E, SETE-289)', async () => {
    seedLesson();
    mockListYouTubeLessons.mockImplementation(() => {
      throw new Error('db locked');
    });
    const rootNavigate = jest.fn();
    const tree = await renderHomeWithYouTube(
      navigation(jest.fn(), rootNavigate),
    );

    await pressCell(tree, 'home-explore-video');

    // History owns the error + retry state, so the failure surfaces there
    // instead of being mistaken for an empty store.
    expect(rootNavigate).toHaveBeenCalledWith('YouTubeHistory');
  });

  it('never routes the video card to Lessons (HVB-02)', async () => {
    seedLesson();
    for (const store of [[{video: {id: 'abc123'}}], []]) {
      mockListYouTubeLessons.mockReturnValue(store);
      const tabNavigate = jest.fn();
      const tree = await renderHomeWithYouTube(navigation(tabNavigate));
      await pressCell(tree, 'home-explore-video');
      const calls = tabNavigate.mock.calls.filter(
        ([name]) => name === 'Lessons',
      );
      expect(calls).toHaveLength(0);
    }
  });
});
