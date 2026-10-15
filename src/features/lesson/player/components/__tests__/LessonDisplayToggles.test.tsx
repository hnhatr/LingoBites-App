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

function openMenu(tree: ReactTestRenderer.ReactTestRenderer) {
  const button = tree.root.findAll(
    node =>
      node.props.testID === 'youtube-display-menu' &&
      typeof node.props.onPress === 'function',
  )[0];
  act(() => button.props.onPress());
}

function findSwitch(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(
    node =>
      node.props.testID === testID &&
      typeof node.props.onValueChange === 'function',
  )[0];
}

describe('LessonDisplayToggles', () => {
  it('shows one labelled header button instead of separate toggles', async () => {
    const tree = await renderToggles();
    const button = tree.root.findAll(
      node =>
        node.props.testID === 'youtube-display-menu' &&
        typeof node.props.onPress === 'function',
    )[0];
    expect(button.props.accessibilityLabel).toBe(
      vi.youtube.study.display_menu_a11y,
    );
  });

  it('fires the translation switch from the menu', async () => {
    const onToggleTranslation = jest.fn();
    const tree = await renderToggles({onToggleTranslation});
    openMenu(tree);
    const toggle = findSwitch(tree, 'youtube-toggle-translation');
    expect(toggle.props.value).toBe(true);
    expect(toggle.props.accessibilityLabel).toBe(
      vi.youtube.study.display_translation,
    );
    act(() => toggle.props.onValueChange(false));
    expect(onToggleTranslation).toHaveBeenCalledTimes(1);
  });

  it('reports IPA state and fires the toggle', async () => {
    const onToggleIpa = jest.fn();
    const tree = await renderToggles({onToggleIpa, showIpa: false});
    openMenu(tree);
    const toggle = findSwitch(tree, 'youtube-toggle-ipa');
    expect(toggle.props.value).toBe(false);
    act(() => toggle.props.onValueChange(true));
    expect(onToggleIpa).toHaveBeenCalledTimes(1);
  });

  it('shows the repeat button only when a repeat handler is given', async () => {
    const withoutLoop = await renderToggles();
    openMenu(withoutLoop);
    expect(
      withoutLoop.root.findAll(
        node => node.props.testID === 'youtube-toggle-loop',
      ),
    ).toHaveLength(0);

    const onCycleRepeat = jest.fn();
    const tree = await renderToggles({sentenceRepeat: 3, onCycleRepeat});
    openMenu(tree);
    const button = tree.root
      .findAll(node => node.props.testID === 'youtube-toggle-loop')
      .find(node => typeof node.props.onPress === 'function');
    expect(button?.props.accessibilityValue).toEqual({text: '3×'});
    act(() => button?.props.onPress());
    expect(onCycleRepeat).toHaveBeenCalledTimes(1);
  });

  it('labels the repeat button "Tắt" when repeating is off', async () => {
    const tree = await renderToggles({
      sentenceRepeat: 0,
      onCycleRepeat: jest.fn(),
    });
    openMenu(tree);
    const button = tree.root
      .findAll(node => node.props.testID === 'youtube-toggle-loop')
      .find(node => typeof node.props.onPress === 'function');
    expect(button?.props.accessibilityValue).toEqual({text: 'Tắt'});
  });
});
