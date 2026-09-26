import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@/test-support';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {startContentLesson} from '@shared/db/ContentLessonStateRepository';
import {listActivePackageLessons} from '@shared/db/ContentRuntimeRepository';
import {AppThemeProvider} from '@theme';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {bootstrapContentPackage} from '../../content/bootstrap/contentBootstrap';
import {HomeScreen} from '../HomeScreen';

function navigation(tabNavigate = jest.fn()) {
  return {
    navigate: jest.fn(),
    getParent: () => ({
      navigate: tabNavigate,
      // SETE-289: HomeScreen resolves the RootStack through the tab parent
      // on every render.
      getParent: () => ({navigate: jest.fn()}),
    }),
  };
}

async function renderHome(nav = navigation()) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}>
        <AppThemeProvider>
          <HomeScreen navigation={nav as never} route={{} as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree;
}

function pressByTestID(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  const target = tree.root
    .findAll(item => item.props.testID === testID)
    .find(item => typeof item.props.onPress === 'function');
  if (!target) throw new Error(`No pressable found for testID ${testID}`);
  return target.props.onPress();
}

describe('HomeScreen learning-only layout (SETE-250 Option B)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('shows the bare starter card on first open — never a dead end', async () => {
    const tabNavigate = jest.fn();
    const tree = await renderHome(navigation(tabNavigate));
    // No started lesson → the starter slot shows the bare variant because
    // the library is empty and there is no past lesson.
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-section')
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-continue-section')
        .length,
    ).toBe(0);
    // The old full-screen empty card is gone; the explore grid and the
    // rail decide their own state and stay visible.
    expect(
      tree.root.findAll(node => node.props.testID === 'home-empty-section')
        .length,
    ).toBe(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-explore-section')
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-lessons-section')
        .length,
    ).toBeGreaterThan(0);
    // Bare variant: a single create CTA (home-starter-first), no pick CTA,
    // and no second create CTA at the bottom of the page.
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-pick')
        .length,
    ).toBe(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-create')
        .length,
    ).toBe(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-lessons-create')
        .length,
    ).toBe(0);
    await act(async () => pressByTestID(tree, 'home-starter-first'));
    expect(tabNavigate).toHaveBeenCalledWith('Create');
  });

  it('keeps lesson creation off Home (moved to the Create tab)', async () => {
    const tree = await renderHome();
    for (const testID of [
      'home-input-camera',
      'home-input-gallery',
      'home-input-paste',
      'home-input-youtube',
    ]) {
      expect(
        tree.root.findAll(node => node.props.testID === testID).length,
      ).toBe(0);
    }
  });

  it('shows the continue block for a started lesson with no fake progress', async () => {
    const installed = await bootstrapContentPackage();
    expect(installed.ok).toBe(true);
    const packaged = listActivePackageLessons()[0];
    expect(packaged).toBeDefined();
    const started = startContentLesson({lessonId: packaged.id});
    expect(started.ok).toBe(true);
    const nav = navigation();
    const tree = await renderHome(nav);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-continue-section')
        .length,
    ).toBeGreaterThan(0);
    // The starter card never shows alongside Continue.
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-section')
        .length,
    ).toBe(0);
    // No progress source exists: no bar and no hard-coded 0% label.
    expect(tree.root.findAllByProps({children: '0%'}).length).toBe(0);
    await act(async () => pressByTestID(tree, 'home-continue-action'));
    expect(nav.navigate).toHaveBeenCalledWith('ContentLessonRuntime', {
      lessonId: packaged.id,
    });
  });
});
