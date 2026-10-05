/**
 * Rendered-text test for HomeHeader greeting (BUG-001, LING-262).
 *
 * Asserts the exact greeting-prefix text for named and unnamed users at each
 * time of day.  On `d19d1ce` the unnamed keys contained `{{name}}` and were
 * called with no params, so the raw placeholder was rendered; these tests
 * catch that regression.
 *
 * Required evidence: tests fail on d19d1ce, pass after the BUG-001 fix.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {buildFlameModel, buildGreeting} from '../../logic/homeScreenModel';
import {HomeHeader} from '../HomeHeader';

function renderHeader(hour: number, displayName: string | null) {
  const greeting = buildGreeting(hour, displayName);
  const flame = buildFlameModel(0);
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <HomeHeader greeting={greeting} streak={0} flame={flame} />
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
  morning: 'Chào buổi sáng!',
  afternoon: 'Chào buổi chiều!',
  night: 'Chào buổi tối!',
};

describe('HomeHeader greeting rendered text (BUG-001, LING-262)', () => {
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
    // The _named key must still contain the {{name}} placeholder in i18n
    // (the a11y path passes params, so interpolation works correctly)
    expect(greeting.hasName).toBe(true);
    expect(greeting.displayName).toBe('An');
  });
});
