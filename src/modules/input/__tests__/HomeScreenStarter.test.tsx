import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@/test-support';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
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



describe('HomeScreen hero card (SETE-279)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  it('shows a single create CTA on first open — never a dead end', async () => {
    const tabNavigate = jest.fn();
    const tree = await renderHome(navigation(tabNavigate));
    // No started lesson → the starter hero shows the bare variant because
    // the library is empty and there is no past lesson.
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-section')
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-continue-section')
        .length,
    ).toBe(0);
    // Single CTA: only the first-create button, no pick row.
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-pick')
        .length,
    ).toBe(0);
    await act(async () => pressByTestID(tree, 'home-starter-first'));
    expect(tabNavigate).toHaveBeenCalledWith('Create');
  });

  it('shows a single pick CTA when the packaged library exists', async () => {
    const installed = await bootstrapContentPackage();
    expect(installed.ok).toBe(true);
    const tabNavigate = jest.fn();
    const nav = navigation(tabNavigate);
    const tree = await renderHome(nav);

    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-pick')
        .length,
    ).toBeGreaterThan(0);
    // One CTA only: create stays hidden while pick leads.
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-create')
        .length,
    ).toBe(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-first')
        .length,
    ).toBe(0);

    await act(async () => pressByTestID(tree, 'home-starter-pick'));
    expect(tabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'ContentLessonList',
    });
  });

  it('falls back to a single create CTA when the library is empty', async () => {
    // Packaged library is empty, so the hero offers create.
    const tabNavigate = jest.fn();
    const tree = await renderHome(navigation(tabNavigate));
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-pick')
        .length,
    ).toBe(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'home-starter-first')
        .length,
    ).toBeGreaterThan(0);
    await act(async () => pressByTestID(tree, 'home-starter-first'));
    expect(tabNavigate).toHaveBeenCalledWith('Create');
  });
});
