import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {themeIds, themes} from '@ui/theme/themeRegistry';

import {HomeWeeklyGoal} from '../../components/HomeWeeklyGoal';

/**
 * SETE-249 D2: the practice chips on Home ("Luyện tập hôm nay") and Library
 * must stay readable in every theme offered by the ThemePicker (≥ 4.5:1).
 * The soft chip backgrounds are translucent, so they are composited over the
 * screen background exactly as React Native renders them.
 *
 * Pairings under test mirror the chips' backgroundKey/inkKey props:
 * review   = accentSoft + primary,
 * speaking = tertiarySoft + onTertiaryContainer,
 * quick    = secondarySoft + secondary.
 */

type RGB = [number, number, number];

function parseColor(value: string): {rgb: RGB; alpha: number} {
  const rgba = value.match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
  );
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: Number(rgba[4]),
    };
  }
  const hex = value.replace('#', '');
  return {
    rgb: [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ],
    alpha: 1,
  };
}

function compositeOver(foreground: string, background: string): RGB {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  return [0, 1, 2].map(
    i => fg.rgb[i] * fg.alpha + bg.rgb[i] * (1 - fg.alpha),
  ) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const linear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRINGS = [
  {name: 'review', backgroundKey: 'accentSoft', inkKey: 'primary'},
  {
    name: 'speaking',
    backgroundKey: 'tertiarySoft',
    inkKey: 'onTertiaryContainer',
  },
  {name: 'quick', backgroundKey: 'secondarySoft', inkKey: 'secondary'},
  // SETE-279 paper-cut home: the fourth explore cell reuses the standard
  // body pairing.
  {
    name: 'explore-practice',
    backgroundKey: 'surfaceContainer',
    inkKey: 'text.primary',
  },
] as const;

// SETE-281 & LING-268: the hero and bubble use fixed brand colors
// checked directly instead of through theme tokens.
const HERO_CTA_BG = '#FFD35E';
const HERO_CTA_INK = '#40320D';
const HERO_BADGE_BG = '#DAF1FA';
const HERO_BADGE_INK = '#134F7E';
const HERO_TITLE = '#FFFFFF';
const HERO_BLUE = '#226FAB';

// LING-268 / LING-267 (§VS-2, §VS-8) v4 tokens
const V4_BUBBLE_BG = '#FFFFFF';
const V4_BUBBLE_INK = '#1C1C10';
const V4_HERO_BG = '#FBF7EE';
const V4_HERO_CTA_BG = '#FFD84D';
const V4_HERO_PRIMARY_INK = '#1C1C10';
const V4_HERO_MUTED_INK = '#6A685C';

const FIXED_PAIRINGS = [
  {name: 'hero-cta', background: HERO_CTA_BG, ink: HERO_CTA_INK},
  {name: 'hero-badge', background: HERO_BADGE_BG, ink: HERO_BADGE_INK},
  {name: 'hero-title', background: HERO_BLUE, ink: HERO_TITLE},
  {name: 'v4-mascot-bubble', background: V4_BUBBLE_BG, ink: V4_BUBBLE_INK},
  {name: 'v4-hero-cta', background: V4_HERO_CTA_BG, ink: V4_HERO_PRIMARY_INK},
  {name: 'v4-hero-primary', background: V4_HERO_BG, ink: V4_HERO_PRIMARY_INK},
  {name: 'v4-hero-muted', background: V4_HERO_BG, ink: V4_HERO_MUTED_INK},
] as const;

function resolveColor(
  theme: (typeof themes)[keyof typeof themes],
  key: string,
): string {
  if (key === 'text.primary') return theme.colors.text.primary;
  if (key === 'text.inverse') return theme.colors.text.inverse;
  return theme.colors[key as keyof typeof theme.colors] as string;
}

describe('practice chip contrast (SETE-249 D2)', () => {
  for (const id of themeIds) {
    for (const pairing of PAIRINGS) {
      it(`${pairing.name} chip is readable in the ${id} theme`, () => {
        const theme = themes[id];
        const background = compositeOver(
          resolveColor(theme, pairing.backgroundKey),
          theme.colors.background,
        );
        const ink = parseColor(resolveColor(theme, pairing.inkKey)).rgb;
        expect(contrast(background, ink)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  for (const pairing of FIXED_PAIRINGS) {
    it(`${pairing.name} hero pairing is readable (fixed brand colors)`, () => {
      const background = parseColor(pairing.background).rgb;
      const ink = parseColor(pairing.ink).rgb;
      expect(contrast(background, ink)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

let mockTheme: (typeof themes)[keyof typeof themes] = themes.default;
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => ({theme: mockTheme}),
  };
});

describe('HomeWeeklyGoal contrast (BUG-002, §VS-3)', () => {
  for (const id of themeIds) {
    it(`weekly-goal count line is readable on surface in ${id} theme (≥ 4.5:1)`, () => {
      mockTheme = themes[id];
      const pawGoal = {totalPaws: 5, filledPaws: 2, goalMet: false};
      const card = {
        completedThisWeek: 2,
        target: 5,
        ringPercent: 40,
        isMet: false,
        countLineKey: 'home.weekly_goal_line' as const,
        countLineParams: {n: 2, target: 5},
        hintKey: 'home.weekly_goal_hint_badge' as const,
        hintParams: {k: 3},
      };
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <HomeWeeklyGoal pawGoal={pawGoal} card={card} />,
        );
      });
      const cardView = renderer.root.findByProps({
        testID: 'home-weekly-goal-card',
      });
      const cardStyle = StyleSheet.flatten(cardView.props.style);
      const cardBg = cardStyle.backgroundColor;

      const textNodes = renderer.root.findAll(
        node =>
          node.props.style &&
          StyleSheet.flatten(node.props.style).fontSize === 15 &&
          StyleSheet.flatten(node.props.style).fontWeight === '700',
      );
      expect(textNodes.length).toBeGreaterThan(0);
      const countLineStyle = StyleSheet.flatten(textNodes[0].props.style);
      const countLineColor = countLineStyle.color;

      const bgRgb = parseColor(cardBg).rgb;
      const inkRgb = parseColor(countLineColor).rgb;
      const ratio = contrast(bgRgb, inkRgb);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
