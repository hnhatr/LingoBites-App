import type {RadiusScale, SixStep, SpacingScale} from './types';

export const spacing: SpacingScale = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius: RadiusScale = {sm: 6, md: 8, lg: 12, xl: 20, pill: 999};

export const fontSize: SixStep = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 30,
};

export const fontWeight = {
  regular: '400',
  medium: '600',
  bold: '700',
} as const;

// Per-variant ceiling for RN's `allowFontScaling` (SETE-125). Groups:
// headings 1.5x, body copy 2.0x, labels/captions 1.3x — see
// docs/implementation-notes/font-scaling-policy.notes.md for rationale.
export const typographyPresets = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700' as const,
    maxFontSizeMultiplier: 1.5,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    maxFontSizeMultiplier: 1.5,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    maxFontSizeMultiplier: 1.5,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    maxFontSizeMultiplier: 1.5,
  },
  title: {
    fontSize: fontSize.xxl,
    lineHeight: 36,
    fontWeight: '700' as const,
    maxFontSizeMultiplier: 1.5,
  },
  subtitle: {
    fontSize: fontSize.md,
    lineHeight: 24,
    fontWeight: '400' as const,
    maxFontSizeMultiplier: 2.0,
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500' as const,
    maxFontSizeMultiplier: 2.0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
    maxFontSizeMultiplier: 2.0,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    maxFontSizeMultiplier: 1.3,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    maxFontSizeMultiplier: 1.3,
  },
};

export const gutter = 16;
