import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type * as AppNavigationModule from '../appNavigation';

// jest.setup.js swaps useAppNavigation for a shared double; test the real one.
const {AppNavigationProvider, useAppNavigation, useOptionalAppNavigation} =
  jest.requireActual<typeof AppNavigationModule>('../appNavigation');

const fakeNavigation = {
  openLesson: jest.fn(),
} as unknown as AppNavigationModule.AppNavigation;

describe('useAppNavigation', () => {
  it('returns the provided navigation', () => {
    let seen: unknown;
    function Probe() {
      seen = useAppNavigation();
      return null;
    }
    act(() => {
      ReactTestRenderer.create(
        <AppNavigationProvider value={fakeNavigation}>
          <Probe />
        </AppNavigationProvider>,
      );
    });
    expect(seen).toBe(fakeNavigation);
  });

  it('throws outside a provider so a missing wiring fails loudly', () => {
    function Probe() {
      useAppNavigation();
      return null;
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        act(() => {
          ReactTestRenderer.create(<Probe />);
        }),
      ).toThrow(
        'useAppNavigation must be used inside <AppNavigationProvider>.',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('useOptionalAppNavigation returns null outside a provider', () => {
    let seen: unknown = 'unset';
    function Probe() {
      seen = useOptionalAppNavigation();
      return null;
    }
    act(() => {
      ReactTestRenderer.create(<Probe />);
    });
    expect(seen).toBeNull();
  });
});
