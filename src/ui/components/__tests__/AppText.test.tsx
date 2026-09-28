import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {defaultThemeId, themes} from '@ui/theme/themeRegistry';
import {AppText} from '../AppText';

async function render(ui: React.ReactElement) {
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

describe('AppText font scaling', () => {
  it('applies the variant preset maxFontSizeMultiplier by default', async () => {
    const tree = await render(<AppText variant="h1">Title</AppText>);
    const text = tree.root.findByType(Text);
    expect(text.props.maxFontSizeMultiplier).toBe(
      themes[defaultThemeId].typography.presets.h1.maxFontSizeMultiplier,
    );
  });

  it('uses a different cap per variant group (body vs label)', async () => {
    const bodyTree = await render(<AppText variant="body">Body</AppText>);
    const labelTree = await render(<AppText variant="label">Label</AppText>);
    const bodyCap = bodyTree.root.findByType(Text).props.maxFontSizeMultiplier;
    const labelCap =
      labelTree.root.findByType(Text).props.maxFontSizeMultiplier;
    expect(bodyCap).toBeGreaterThan(labelCap);
  });

  it('allows overriding the cap via prop', async () => {
    const tree = await render(
      <AppText variant="body" maxFontSizeMultiplier={3}>
        Body
      </AppText>,
    );
    const text = tree.root.findByType(Text);
    expect(text.props.maxFontSizeMultiplier).toBe(3);
  });
});
