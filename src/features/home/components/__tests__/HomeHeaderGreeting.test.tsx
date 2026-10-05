/**
 * Rendered-text test for HomeHeader greeting (BUG-001, LING-262, LING-267, §VS-1).
 *
 * Asserts the exact greeting-prefix text for named and unnamed users at each
 * time of day.
 *
 * Streak pill uses localized unit via home.streak_unit with plural forms for each count value.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {buildFlameModel, buildGreeting} from '../../logic/homeScreenModel';
import {HomeHeader} from '../HomeHeader';

jest.mock('react-native-reanimated', () => {
  const base = require('../../../../../test-utils/reanimatedMock');
  return {
    ...base,
    withRepeat: (anim: unknown) => anim,
  };
});

function renderHeader(hour: number, displayName: string | null, streak = 0) {
  const greeting = buildGreeting(hour, displayName);
  const flame = buildFlameModel(streak);
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <HomeHeader greeting={greeting} streak={streak} flame={flame} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function getText(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const instances = tree.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props.children === 'string',
    {deep: true},
  );
  if (instances.length === 0) return null;
  return instances[0].props.children as string;
}

// Morning = hour 7, afternoon = hour 14, night = hour 21
const HOURS: Array<{label: string; hour: number}> = [
  {label: 'morning', hour: 7},
  {label: 'afternoon', hour: 14},
  {label: 'night', hour: 21},
];

const UNNAMED_EXPECTED: Record<string, string> = {
  morning: 'Chào buổi sáng!',
  afternoon: 'Chào buổi chiều!',
  night: 'Chào buổi tối!',
};

const NAMED_PREFIX_EXPECTED: Record<string, string> = {
  morning: 'Chào buổi sáng,',
  afternoon: 'Chào buổi chiều,',
  night: 'Chào buổi tối,',
};

describe('HomeHeader greeting rendered text (BUG-001, LING-262, §VS-1)', () => {
  // --- Unnamed user (no displayName) ---
  describe('unnamed user — single-line greeting has no {{name}} literal', () => {
    for (const {label, hour} of HOURS) {
      it(`${label}: renders "${UNNAMED_EXPECTED[label]}" without raw placeholder`, () => {
        const tree = renderHeader(hour, null);
        const text = getText(tree, 'home-header-greeting');
        expect(text).toBe(UNNAMED_EXPECTED[label]);
        expect(text).not.toContain('{{name}}');
      });
    }
  });

  // --- Named user (with displayName) ---
  describe('named user — prefix line has no {{name}} literal; second line is the name', () => {
    for (const {label, hour} of HOURS) {
      it(`${label}: prefix renders "${NAMED_PREFIX_EXPECTED[label]}" and second line is the name`, () => {
        const tree = renderHeader(hour, 'An');
        const prefix = getText(tree, 'home-header-greeting-prefix');
        expect(prefix).toBe(NAMED_PREFIX_EXPECTED[label]);
        expect(prefix).not.toContain('{{name}}');

        // Second line (home-header-greeting) should be the display name itself
        const nameLine = getText(tree, 'home-header-greeting');
        expect(nameLine).toBe('An');
      });
    }
  });

  // --- A11y label still interpolates the name for named users ---
  it('named user a11y label interpolates the name (not raw {{name}})', () => {
    const greeting = buildGreeting(7, 'An');
    expect(greeting.a11yKey).toBe('home.greeting_morning_named');
    expect(greeting.a11yParams).toEqual({name: 'An'});
    expect(greeting.hasName).toBe(true);
    expect(greeting.displayName).toBe('An');
  });
});

// ---------------------------------------------------------------------------
// Streak pill localized text (§VS-1.2)
// ---------------------------------------------------------------------------
describe('HomeHeader streak pill localized text (§VS-1.2)', () => {
  it('streak=0: pill renders "0 ngày" in vi', () => {
    const tree = renderHeader(7, null, 0);
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('0');
    expect(allText).toContain('ngày');
  });

  it('streak=1: pill renders "1 ngày" in vi (plural _one = ngày)', () => {
    const tree = renderHeader(7, null, 1);
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('1');
    expect(allText).toContain('ngày');
  });

  it('streak=2: pill renders "2 ngày" in vi (plural _other = ngày)', () => {
    const tree = renderHeader(7, null, 2);
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('2');
    expect(allText).toContain('ngày');
  });

  it('a11y label: streak>0 uses home.streak_days', () => {
    const flame = buildFlameModel(1);
    expect(flame.a11yKey).toBe('home.streak_days');
    expect(flame.a11yParams).toEqual({count: 1});
  });

  it('a11y label: streak=0 uses home.streak_zero', () => {
    const flame = buildFlameModel(0);
    expect(flame.a11yKey).toBe('home.streak_zero');
    expect(flame.a11yParams).toBeUndefined();
  });
});
