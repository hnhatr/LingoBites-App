import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {
  resetConnectivityForTests,
  useConnectivityStore,
} from '@core/api/connectivity';
import {FeatureFlagProvider} from '@core/release';

import {AppButton} from '../AppButton';
import {AppScreen} from '../AppScreen';
import {LockedFeature} from '../LockedFeature';

async function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const banners = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => node.props.testID === 'offline-banner');

beforeEach(() => {
  resetConnectivityForTests();
});

describe('offline UI (offline-mode.md §3)', () => {
  it('shows the banner on every screen only while offline', async () => {
    const tree = await render(
      <AppScreen>
        <Text>content</Text>
      </AppScreen>,
    );
    expect(banners(tree)).toHaveLength(0);

    await act(async () => {
      useConnectivityStore.setState({status: 'offline'});
    });
    expect(banners(tree).length).toBeGreaterThan(0);

    await act(async () => {
      useConnectivityStore.setState({status: 'online'});
    });
    expect(banners(tree)).toHaveLength(0);
  });

  it('lets a screen opt out of the banner', async () => {
    useConnectivityStore.setState({status: 'offline'});
    const tree = await render(<AppScreen showOfflineBanner={false} />);
    expect(banners(tree)).toHaveLength(0);
  });

  it('retries by probing the connection', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ok: true, status: 200});
    global.fetch = mockFetch as unknown as typeof fetch;
    useConnectivityStore.setState({status: 'offline'});
    const tree = await render(<LockedFeature message="Needs the Server." />);

    await act(async () => {
      tree.root.findByType(AppButton).props.onPress();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(useConnectivityStore.getState().status).toBe('online');
  });
});
