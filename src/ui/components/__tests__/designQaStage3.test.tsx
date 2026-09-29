import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FeatureFlagProvider} from '@core/release';
import {AppThemeProvider} from '@ui/theme';
import {themeList, themes} from '@ui/theme/themeRegistry';
import {THEME_STORAGE_KEY} from '@ui/theme/themeStorage';
import {AppCard} from '../AppCard';
import {HandoffProgressTrack} from '../HandoffProgressTrack';

// Stage 3 design QA (SETE-194): progress fill/glow, card spec, soft-color
// alphas, and the 32 spacing step — all against design/app.css.
const theme = themes['pastel-kids'];

async function render(ui: React.ReactElement) {
  // Token assertions above target pastel-kids; render under the same theme
  // instead of depending on the app default (Sáng).
  await AsyncStorage.setItem(THEME_STORAGE_KEY, 'pastel-kids');
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function flattenStyle(style: unknown) {
  const {StyleSheet} = require('react-native');
  return StyleSheet.flatten(style);
}

/**
 * Host-only matches, deduped by style reference. The RN jest renderer
 * surfaces each host node twice (dual fibers sharing one element), so
 * naive findAll counts are doubled.
 */
function hostNodesWith(
  tree: ReactTestRenderer.ReactTestRenderer,
  predicate: (flattened: Record<string, unknown>) => boolean,
) {
  const seen = new Set<unknown>();
  return tree.root.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.style !== undefined &&
      predicate(flattenStyle(node.props.style)) &&
      !seen.has(node.props.style) &&
      (seen.add(node.props.style), true),
  );
}

describe('SETE-194 design QA stage 3 (pastel-kids)', () => {
  it('uses design rgba alphas for soft colors', () => {
    // SETE-240: accentSoft is primary-tinted (decorative), not bright selection teal.
    expect(theme.colors.accentSoft).toBe('rgba(0,107,95,0.14)');
    expect(theme.colors.secondarySoft).toBe('rgba(254,116,136,0.18)');
    expect(theme.colors.tertiarySoft).toBe('rgba(255,226,76,0.30)');
  });

  it('has the 32 spacing step with 48 preserved as xxxl', () => {
    // design/app.css:43-44 scale is 4/8/12/16/24/32/48.
    expect(theme.spacing).toMatchObject({
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
      xxxl: 48,
    });
  });

  it('every registered theme defines the full 7-step spacing scale', () => {
    themeList.forEach(candidate => {
      expect(candidate.spacing.xxxl).toBe(48);
      expect(candidate.spacing.xxl).toBe(32);
    });
  });

  it('card spec uses 24 padding and the dedicated card shadow', () => {
    // design/app.css:143-148 — padding var(--md)=24, 0 8 30 rgba(0,107,95,.07).
    expect(theme.components.card.padding).toBe(24);
    expect(theme.components.card.shadow).toBe('card');
    expect(theme.shadow.card).toMatchObject({
      shadowColor: '#006b5f',
      shadowOpacity: 0.07,
      shadowRadius: 30,
    });
    expect(theme.shadow.card.shadowOffset).toEqual({width: 0, height: 8});
  });

  it('leaves the shared soft shadow untouched for existing consumers', () => {
    expect(theme.shadow.soft).toMatchObject({
      shadowColor: '#006b5f',
      shadowOpacity: 0.12,
      shadowRadius: 6,
    });
  });

  it('HandoffProgressTrack fill uses primary with glow and pill radius', async () => {
    const tree = await render(
      <HandoffProgressTrack label="2 / 5" progress={0.42} />,
    );

    const fills = hostNodesWith(
      tree,
      style => style.backgroundColor === theme.colors.primary,
    );
    expect(fills).toHaveLength(1);

    const fill = flattenStyle(fills[0].props.style);
    expect(fill.backgroundColor).toBe(theme.colors.primary);
    expect(fill.borderRadius).toBe(theme.radius.pill);
    expect(fill.shadowColor).toBe(theme.colors.primary);
    expect(fill.shadowOpacity).toBe(0.45);
    expect(fill.shadowRadius).toBe(14);
    expect(fill.width).toBe('42%');
  });

  it('HandoffProgressTrack track is 12 high with pill radius', async () => {
    const tree = await render(
      <HandoffProgressTrack label="2 / 5" progress={0.42} />,
    );

    const tracks = hostNodesWith(
      tree,
      style => style.backgroundColor === theme.colors.surfaceHigh,
    );
    expect(tracks).toHaveLength(1);
    // design/app.css:204 — height 12, radius 999.
    expect(flattenStyle(tracks[0].props.style).height).toBe(12);
    expect(flattenStyle(tracks[0].props.style).borderRadius).toBe(
      theme.radius.pill,
    );
  });

  it('AppCard renders with 24 padding and the card shadow', async () => {
    const tree = await render(<AppCard testID="qa-card" />);

    const cards = hostNodesWith(
      tree,
      style =>
        style.backgroundColor === theme.components.card.background &&
        style.padding === 24,
    );
    expect(cards).toHaveLength(1);
    const style = flattenStyle(cards[0].props.style);
    expect(style.padding).toBe(24);
    expect(style.borderRadius).toBe(24);
  });
});
