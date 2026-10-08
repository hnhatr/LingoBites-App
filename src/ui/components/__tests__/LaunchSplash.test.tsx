import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {
  LAUNCH_SPLASH_EXIT_MS,
  LAUNCH_SPLASH_HOLD_MS,
  LaunchSplash,
} from '../LaunchSplash';

let mockReducedMotion = false;

jest.mock('react-native-reanimated', () => {
  const base = require('../../../../test-utils/reanimatedMock');
  return {
    ...base,
    useReducedMotion: () => mockReducedMotion,
    withRepeat: (anim: unknown) => anim,
  };
});

function lettersOf(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType('Text' as any)
    .map(node => node.props.children)
    .join('');
}

describe('LaunchSplash', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the logo tile, wordmark and letter chips', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(<LaunchSplash onFinish={jest.fn()} />);
    });

    expect(tree.root.findByProps({testID: 'launch-splash'})).toBeTruthy();
    expect(tree.root.findAllByType('Image' as any)).toHaveLength(1);
    expect(lettersOf(tree)).toContain('LingoBites');
    expect(lettersOf(tree)).toContain('Aa');
  });

  it('calls onFinish once after the hold and fade-out', () => {
    const onFinish = jest.fn();
    act(() => {
      ReactTestRenderer.create(<LaunchSplash onFinish={onFinish} />);
    });

    act(() => {
      jest.advanceTimersByTime(LAUNCH_SPLASH_HOLD_MS);
    });
    expect(onFinish).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(LAUNCH_SPLASH_EXIT_MS);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('finishes quickly when reduced motion is enabled', () => {
    mockReducedMotion = true;
    const onFinish = jest.fn();
    act(() => {
      ReactTestRenderer.create(<LaunchSplash onFinish={onFinish} />);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not call onFinish after unmounting', () => {
    const onFinish = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(<LaunchSplash onFinish={onFinish} />);
    });
    act(() => {
      tree.unmount();
    });
    jest.runAllTimers();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
