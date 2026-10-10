import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {useLaunchUpdate} from '../../logic/useLaunchUpdate';
import {AppUpdateOverlay} from '../AppUpdateOverlay';

jest.mock('../../logic/useLaunchUpdate', () => ({
  useLaunchUpdate: jest.fn(),
}));

const mockUseLaunchUpdate = useLaunchUpdate as jest.MockedFunction<
  typeof useLaunchUpdate
>;

function renderOverlay() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <AppUpdateOverlay />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function overlay(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(node => node.props.testID === 'app-update-overlay');
}

describe('AppUpdateOverlay', () => {
  it.each(['checking', 'done'] as const)('renders nothing while %s', phase => {
    mockUseLaunchUpdate.mockReturnValue({phase, progress: 0});
    expect(overlay(renderOverlay())).toHaveLength(0);
  });

  it('shows the download progress', () => {
    mockUseLaunchUpdate.mockReturnValue({phase: 'downloading', progress: 0.42});
    const tree = renderOverlay();
    expect(overlay(tree).length).toBeGreaterThan(0);
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Đang cập nhật');
    expect(text).toContain('Đã tải 42%');
  });

  it('shows a full bar while reloading', () => {
    mockUseLaunchUpdate.mockReturnValue({phase: 'reloading', progress: 1});
    expect(JSON.stringify(renderOverlay().toJSON())).toContain('Đã tải 100%');
  });
});
