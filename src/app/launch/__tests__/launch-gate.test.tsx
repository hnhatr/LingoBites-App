import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {resetAccountStoreForTests, useAccountStore} from '@features/account';
import {useLaunchUpdate} from '@features/appUpdate';

import {
  LAUNCH_SPLASH_EXIT_MS,
  LAUNCH_SPLASH_HOLD_MS,
} from '@ui/components/LaunchSplash';

import {LAUNCH_GATE_SLOW_HINT_MS, LaunchGate} from '../LaunchGate';

jest.mock('react-native-reanimated', () => {
  const base = require('../../../../test-utils/reanimatedMock');
  return {
    ...base,
    useReducedMotion: () => false,
    withRepeat: (anim: unknown) => anim,
  };
});

jest.mock('@features/appUpdate', () => ({
  useLaunchUpdate: jest.fn(),
}));

const mockUseLaunchUpdate = useLaunchUpdate as jest.MockedFunction<
  typeof useLaunchUpdate
>;

let mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<LaunchGate />);
  });
  mounted.push(tree);
  return tree;
}

function byTestId(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(node => node.props.testID === testID);
}

function text(tree: ReactTestRenderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('LaunchGate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetAccountStoreForTests();
    mockUseLaunchUpdate.mockReturnValue({phase: 'done', progress: 0});
  });

  afterEach(() => {
    act(() => {
      mounted.forEach(tree => tree.unmount());
    });
    mounted = [];
    jest.useRealTimers();
  });

  it('fades straight into the app when ready before the intro ends', () => {
    useAccountStore.setState({phase: 'authenticated'});
    const tree = render();
    expect(byTestId(tree, 'launch-gate').length).toBeGreaterThan(0);

    advance(LAUNCH_SPLASH_HOLD_MS + LAUNCH_SPLASH_EXIT_MS);
    expect(tree.toJSON()).toBeNull();
  });

  it('settles into loading, then leaves once the account is ready', () => {
    useAccountStore.setState({phase: 'bootstrapping'});
    const tree = render();
    advance(LAUNCH_SPLASH_HOLD_MS);
    expect(text(tree)).toContain('Đang mở LingoBites…');

    advance(LAUNCH_GATE_SLOW_HINT_MS);
    expect(text(tree)).toContain('Mạng hơi chậm, chờ thêm chút nhé');

    act(() => {
      useAccountStore.setState({phase: 'authenticated'});
    });
    advance(LAUNCH_SPLASH_EXIT_MS);
    expect(tree.toJSON()).toBeNull();
  });

  it('shows OTA progress on the same gate', () => {
    useAccountStore.setState({phase: 'authenticated'});
    mockUseLaunchUpdate.mockReturnValue({phase: 'downloading', progress: 0.42});
    const tree = render();
    advance(LAUNCH_SPLASH_HOLD_MS);
    expect(byTestId(tree, 'launch-gate-update').length).toBeGreaterThan(0);
    expect(text(tree)).toContain('Đang tải bản mới');
    expect(text(tree)).toContain('42%');

    mockUseLaunchUpdate.mockReturnValue({phase: 'reloading', progress: 1});
    act(() => {
      tree.update(<LaunchGate />);
    });
    expect(text(tree)).toContain('Xong rồi, đang mở lại…');
    expect(text(tree)).toContain('100%');
  });

  it('shows the signed-out gate and retries once on Continue', () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    useAccountStore.setState({phase: 'signed-out', retry});
    const tree = render();
    advance(LAUNCH_SPLASH_HOLD_MS);
    expect(text(tree)).toContain('Bạn đã đăng xuất');
    expect(retry).not.toHaveBeenCalled();

    const action = tree.root.findByProps({testID: 'launch-gate-action'});
    expect(action.props.accessibilityLabel).toBe('Tiếp tục');
    act(() => {
      action.props.onPress();
    });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows the boot failure message with Retry', () => {
    useAccountStore.setState({phase: 'failed', failureMessage: null});
    const tree = render();
    advance(LAUNCH_SPLASH_HOLD_MS);
    expect(text(tree)).toContain('Không thể mở tài khoản. Vui lòng thử lại.');
    expect(
      tree.root.findByProps({testID: 'launch-gate-action'}).props
        .accessibilityLabel,
    ).toBe('Thử lại');
  });

  it('comes back without the intro when the app needs the gate again', () => {
    useAccountStore.setState({phase: 'authenticated'});
    const tree = render();
    advance(LAUNCH_SPLASH_HOLD_MS + LAUNCH_SPLASH_EXIT_MS);
    expect(tree.toJSON()).toBeNull();

    act(() => {
      useAccountStore.setState({phase: 'signed-out'});
    });
    // Already settled: the status is live at once, with no intro hold.
    expect(text(tree)).toContain('Bạn đã đăng xuất');
    expect(tree.root.findByProps({testID: 'launch-gate-action'})).toBeTruthy();
    expect(text(tree)).toContain('"importantForAccessibility":"auto"');
  });
});
