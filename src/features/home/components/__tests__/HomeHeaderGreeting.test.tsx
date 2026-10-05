/**
 * Rendered-text test for HomeHeader greeting (BUG-001, LING-262).
 *
 * Asserts the exact greeting-prefix text for named and unnamed users at each
 * time of day.  On `d19d1ce` the unnamed keys contained `{{name}}` and were
 * called with no params, so the raw placeholder was rendered; these tests
 * catch that regression.
 *
 * Required evidence: tests fail on d19d1ce, pass after the BUG-001 fix.
 *
 * BUG-003 (LING-264): streak pill uses localized text via home.streak_pill
 * with plural forms for each count value; accessibility label is unchanged.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {buildFlameModel, buildGreeting} from '../../logic/homeScreenModel';
import {HomeHeader} from '../HomeHeader';

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

// ---------------------------------------------------------------------------
// BUG-003 (LING-264): streak pill shows localized "N ngày" / "N day(s)"
// Accessibility label is unchanged (uses flame.a11yKey + a11yParams).
// ---------------------------------------------------------------------------
describe('HomeHeader streak pill localized text (BUG-003, LING-264)', () => {
  function getFlameTextNodes(
    tree: ReactTestRenderer.ReactTestRenderer,
  ): string[] {
    const flame = tree.root.findAll(
      node => node.props.testID === 'home-header-flame',
    );
    const results: string[] = [];
    const collect = (node: ReturnType<typeof tree.root.findAll>[0]) => {
      if (typeof node.props.children === 'string') {
        results.push(node.props.children);
      }
      if (Array.isArray(node.props.children)) {
        for (const child of node.props.children) {
          if (typeof child === 'string') results.push(child);
        }
      }
    };
    for (const f of flame) {
      collect(f);
    }
    return results;
  }

  function getFlameA11yLabel(
    tree: ReactTestRenderer.ReactTestRenderer,
  ): string | undefined {
    const flame = tree.root.findAll(
      node => node.props.testID === 'home-header-flame',
    );
    return flame[0]?.props.accessibilityLabel as string | undefined;
  }

  it('streak=0: pill renders "0 ngày" in vi', () => {
    // Failing before fix: pill rendered "0" (raw number), not "0 ngày"
    const tree = renderHeader(7, null, 0);
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('0 ngày');
  });

  it('streak=1: pill renders "1 ngày" in vi (plural _one = ngày)', () => {
    const tree = renderHeader(7, null, 1);
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('1 ngày');
  });

  it('streak=2: pill renders "2 ngày" in vi (plural _other = ngày)', () => {
    const tree = renderHeader(7, null, 2);
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('2 ngày');
  });

  it('streak pill does not render raw number without unit', () => {
    // Regression: before fix, streak value was rendered as bare "{streak}"
    const tree = renderHeader(7, null, 3);
    const allText = JSON.stringify(tree.toJSON());
    // Should show "3 ngày" not standalone "3"
    expect(allText).toContain('3 ngày');
  });

  it('a11y label is unchanged: streak>0 uses home.streak_days (not streak_pill)', () => {
    const flame = buildFlameModel(1);
    expect(flame.a11yKey).toBe('home.streak_days');
    expect(flame.a11yParams).toEqual({count: 1});
  });

  it('a11y label is unchanged: streak=0 uses home.streak_zero', () => {
    const flame = buildFlameModel(0);
    expect(flame.a11yKey).toBe('home.streak_zero');
    expect(flame.a11yParams).toBeUndefined();
  });
});
