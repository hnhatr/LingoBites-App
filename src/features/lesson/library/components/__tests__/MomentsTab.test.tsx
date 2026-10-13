import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {MomentsTab} from '../tabs/MomentsTab';

const mockFetch = jest.fn();
const mockReadCache = jest.fn();

jest.mock('../../logic/momentLibrary', () => ({
  fetchMomentLibrary: () => mockFetch(),
  readCachedMomentLibrary: () => mockReadCache(),
}));

jest.mock('@features/analytics', () => ({trackEvent: jest.fn()}));

jest.mock('@core/api/connectivity', () => ({useIsOffline: () => false}));

const moment = (lessonId: string, title: string) => ({
  lessonId,
  title,
  intent: null,
  situationTitleVi: null,
  thumbnailUri: null,
  createdAt: '2026-10-06T00:00:00.000Z',
});

async function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <MomentsTab />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('MomentsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadCache.mockResolvedValue(null);
  });

  it('opens the grid with a cell to start a new moment', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      value: [moment('a', 'Hỏi đường ở sân bay'), moment('b', 'Khám bệnh')],
    });
    const tree = await render();
    expect(
      tree.root.findAllByProps({testID: 'moment-card-a'}),
    ).not.toHaveLength(0);
    act(() => {
      tree.root.findByProps({testID: 'library-moments-new'}).props.onPress();
    });
    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'situation',
    });
    act(() => {
      tree.root.findByProps({testID: 'moment-card-b'}).props.onPress();
    });
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('b');
  });

  it('keeps the new cell and a hint when there is no moment yet', async () => {
    mockFetch.mockResolvedValue({ok: true, value: []});
    const tree = await render();
    expect(
      tree.root.findAllByProps({testID: 'library-moments-new'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-moments-empty'}),
    ).not.toHaveLength(0);
  });

  it('offers a retry when the list cannot load', async () => {
    mockFetch.mockResolvedValue({ok: false, message: 'Lỗi máy chủ'});
    const tree = await render();
    expect(
      tree.root.findByProps({testID: 'library-moments-error'}).props.children,
    ).toBe('Lỗi máy chủ');
    await act(async () => {
      tree.root.findByProps({testID: 'library-moments-retry'}).props.onPress();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
