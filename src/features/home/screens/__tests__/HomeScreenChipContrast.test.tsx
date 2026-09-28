import {themeIds, themes} from '@ui/theme/themeRegistry';

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

// SETE-281: the hero CTA uses fixed brand colors (yellow on the fixed
// deep-blue card) in every theme, so it is checked directly instead of
// through theme tokens.
const HERO_CTA_BG = '#FFD35E';
const HERO_CTA_INK = '#40320D';
const HERO_BADGE_BG = '#DAF1FA';
const HERO_BADGE_INK = '#134F7E';
const HERO_TITLE = '#FFFFFF';
const HERO_BLUE = '#226FAB';

const FIXED_PAIRINGS = [
  {name: 'hero-cta', background: HERO_CTA_BG, ink: HERO_CTA_INK},
  {name: 'hero-badge', background: HERO_BADGE_BG, ink: HERO_BADGE_INK},
  {name: 'hero-title', background: HERO_BLUE, ink: HERO_TITLE},
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
