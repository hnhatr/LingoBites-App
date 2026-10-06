import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import vi from '@core/i18n/vi.json';
import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {LessonDisplayToggles} from '../LessonDisplayToggles';

async function renderToggles(
  props: Partial<React.ComponentProps<typeof LessonDisplayToggles>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <LessonDisplayToggles
            onToggleIpa={jest.fn()}
            onToggleTranslation={jest.fn()}
            showIpa
            showTranslation
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('LessonDisplayToggles', () => {
  it('labels and fires the translation toggle', async () => {
    const onToggleTranslation = jest.fn();
    const tree = await renderToggles({onToggleTranslation});
    const toggle = tree.root.findAll(
      node =>
        node.props.testID === 'youtube-toggle-translation' &&
        typeof node.props.onPress === 'function',
    )[0];
    expect(toggle.props.accessibilityLabel).toBe(
      vi.youtube.translation_hide_a11y,
    );
    act(() => toggle.props.onPress());
    expect(onToggleTranslation).toHaveBeenCalledTimes(1);
  });

  it('reports IPA selected state and fires the toggle', async () => {
    const onToggleIpa = jest.fn();
    const tree = await renderToggles({onToggleIpa, showIpa: false});
    const toggle = tree.root.findAll(
      node =>
        node.props.testID === 'youtube-toggle-ipa' &&
        typeof node.props.onPress === 'function',
    )[0];
    expect(toggle.props.accessibilityState?.selected).toBe(false);
    act(() => toggle.props.onPress());
    expect(onToggleIpa).toHaveBeenCalledTimes(1);
  });
});
