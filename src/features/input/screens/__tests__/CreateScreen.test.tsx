import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {ReleaseConfig} from '@core/release/types';

import {
  ALL_IMPLEMENTED_FEATURES,
  CORE_WITH_REVIEW,
  makeTestReleaseConfig,
  mockAppNavigation,
  OFFLINE_REVIEW_MVP,
} from '@test/support';

import {CreateScreen} from '../CreateScreen';

const mockUseYouTubeServerEnabled = jest.fn();

// SETE-290: the creation tile needs the server capability too — control it
// here so tile tests stay deterministic without network.
jest.mock('@core/api/youtubeCapabilities', () => ({
  useYouTubeServerEnabled: (...args: unknown[]) =>
    mockUseYouTubeServerEnabled(...args),
}));

function navigation() {
  const tabNavigate = jest.fn();
  const rootNavigate = jest.fn();
  return {
    navigate: jest.fn(),
    rootNavigate,
    tabNavigate,
    getParent: () => ({
      navigate: tabNavigate,
      getParent: () => ({navigate: rootNavigate}),
    }),
  };
}

async function renderCreate(
  nav = navigation(),
  releaseConfig: ReleaseConfig = makeTestReleaseConfig(CORE_WITH_REVIEW),
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={releaseConfig}>
        <AppThemeProvider>
          <CreateScreen navigation={nav as never} route={{} as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  return tree;
}

async function pressByTestID(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  const target = tree.root
    .findAll(item => item.props.testID === testID)
    .find(item => typeof item.props.onPress === 'function');
  if (!target) throw new Error(`No pressable found for testID ${testID}`);
  await act(async () => target.props.onPress());
}

describe('CreateScreen (SETE-247)', () => {
  it('hero camera routes to ImageCapture with camera source', async () => {
    const nav = navigation();
    const tree = await renderCreate(nav);
    await pressByTestID(tree, 'create-hero-camera');
    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'camera',
    });
  });

  it('uniform tiles route to gallery upload and paste text', async () => {
    const nav = navigation();
    const tree = await renderCreate(nav);
    await pressByTestID(tree, 'create-tile-gallery');
    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'gallery',
    });
    await pressByTestID(tree, 'create-tile-paste');
    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'paste',
    });
  });

  it('shows the OCR tip while image input is enabled', async () => {
    const tree = await renderCreate();
    expect(
      tree.root.findAll(node => node.props.testID === 'create-tip-card').length,
    ).toBeGreaterThan(0);
  });

  it('shows YouTube entry points only when the flag is on', async () => {
    mockUseYouTubeServerEnabled.mockReturnValue(true);
    const flaggedOff = await renderCreate();
    expect(
      flaggedOff.root.findAll(
        node => node.props.testID === 'create-tile-youtube',
      ).length,
    ).toBe(0);

    const nav = navigation();
    const flaggedOn = await renderCreate(
      nav,
      makeTestReleaseConfig(ALL_IMPLEMENTED_FEATURES),
    );
    await pressByTestID(flaggedOn, 'create-tile-youtube');
    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'youtube',
    });
    await pressByTestID(flaggedOn, 'create-history-link');
    expect(mockAppNavigation.openCatalog).toHaveBeenCalled();
    // The Create tab never reaches into another tab's stack.
    expect(nav.tabNavigate).not.toHaveBeenCalled();
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('hides YouTube entry points when the server capability is off (SETE-290)', async () => {
    mockUseYouTubeServerEnabled.mockReturnValue(false);
    const tree = await renderCreate(
      navigation(),
      makeTestReleaseConfig(ALL_IMPLEMENTED_FEATURES),
    );
    expect(
      tree.root.findAll(node => node.props.testID === 'create-tile-youtube')
        .length,
    ).toBe(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'create-history-link')
        .length,
    ).toBe(0);
  });

  it('renders an empty state instead of a blank screen when all sources are off', async () => {
    const tree = await renderCreate(
      navigation(),
      makeTestReleaseConfig(OFFLINE_REVIEW_MVP),
    );
    expect(
      tree.root.findAll(node => node.props.testID === 'create-empty-state')
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll(node => node.props.testID === 'create-hero-camera')
        .length,
    ).toBe(0);
  });
});
