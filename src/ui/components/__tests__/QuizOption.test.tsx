import React from 'react';
import {StyleSheet, Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support/index';
import {AppThemeProvider, useAppTheme, type AppTheme} from '@ui/theme/index';
import {QuizOption} from '../QuizOption';

let activeTheme!: AppTheme;

function ThemeProbe() {
  const {theme} = useAppTheme();
  activeTheme = theme;
  return null;
}

async function renderWithTheme(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <ThemeProbe />
          {ui}
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function containerOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const hosts = tree.root
    .findAllByProps({testID: 'quiz-option'})
    .filter(node => typeof node.type === 'string');
  if (hosts.length === 0) {
    throw new Error('quiz-option host container not found');
  }
  return hosts[0];
}

function containerStyleOf(tree: ReactTestRenderer.ReactTestRenderer) {
  return StyleSheet.flatten(containerOf(tree).props.style);
}

function keyCircleOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const keyText = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === 'B');
  if (!keyText) {
    return null;
  }
  let parent = keyText.parent;
  while (parent) {
    const flat = StyleSheet.flatten(parent.props.style);
    if (flat?.width === 30 && flat?.height === 30) {
      return flat;
    }
    parent = parent.parent;
  }
  return null;
}

describe('QuizOption', () => {
  it('renders the key circle when optionKey is provided', async () => {
    const tree = await renderWithTheme(
      <QuizOption
        testID="quiz-option"
        label="Bonjour"
        onPress={() => {}}
        optionKey="B"
      />,
    );

    expect(keyCircleOf(tree)).not.toBeNull();
  });

  it('hides the key circle when optionKey is omitted', async () => {
    const tree = await renderWithTheme(
      <QuizOption testID="quiz-option" label="Bonjour" />,
    );

    expect(keyCircleOf(tree)).toBeNull();
  });

  it('uses the base geometry and surface colors by default', async () => {
    const tree = await renderWithTheme(
      <QuizOption
        testID="quiz-option"
        label="Bonjour"
        onPress={() => {}}
        optionKey="B"
      />,
    );

    const style = containerStyleOf(tree);
    expect(style.borderWidth).toBe(2);
    expect(style.borderRadius).toBe(18);
    expect(style.borderColor).toBe(activeTheme.colors.surfaceHigh);
    expect(style.backgroundColor).toBe(activeTheme.colors.surface);
  });

  it('maps the legacy selected flag to the selected state', async () => {
    const tree = await renderWithTheme(
      <QuizOption
        testID="quiz-option"
        label="Bonjour"
        onPress={() => {}}
        selected
      />,
    );

    const style = containerStyleOf(tree);
    expect(style.borderWidth).toBe(2);
    expect(style.borderRadius).toBe(18);
    expect(style.borderColor).toBe(activeTheme.colors.primary);
  });

  it('lets the state prop take precedence over the selected flag', async () => {
    const tree = await renderWithTheme(
      <QuizOption
        testID="quiz-option"
        label="Bonjour"
        onPress={() => {}}
        selected
        state="wrong"
      />,
    );

    expect(containerStyleOf(tree).borderColor).toBe(
      activeTheme.colors.secondaryContainer,
    );
  });

  it('renders the correct state with accent border and accent-soft fill', async () => {
    const tree = await renderWithTheme(
      <QuizOption
        testID="quiz-option"
        label="Bonjour"
        onPress={() => {}}
        optionKey="B"
        state="correct"
      />,
    );

    const style = containerStyleOf(tree);
    expect(style.borderColor).toBe(activeTheme.colors.accent);
    expect(style.backgroundColor).toBe(activeTheme.colors.accentSoft);
    expect(keyCircleOf(tree)?.backgroundColor).toBe(activeTheme.colors.accent);
  });

  it('renders the wrong state with coral border and coral 10% fill', async () => {
    const tree = await renderWithTheme(
      <QuizOption
        testID="quiz-option"
        label="Bonjour"
        onPress={() => {}}
        optionKey="B"
        state="wrong"
      />,
    );

    const style = containerStyleOf(tree);
    expect(style.borderColor).toBe(activeTheme.colors.secondaryContainer);
    expect(style.backgroundColor).toBe('rgba(254,116,136,0.1)');
    expect(keyCircleOf(tree)?.backgroundColor).toBe(
      activeTheme.colors.secondaryContainer,
    );
  });

  it('stays read-only without onPress and interactive with it', async () => {
    const readOnly = await renderWithTheme(
      <QuizOption testID="quiz-option" label="Bonjour" />,
    );
    expect(
      readOnly.root.findAll(node => node.props.accessibilityRole === 'button'),
    ).toHaveLength(2);

    const interactive = await renderWithTheme(
      <QuizOption
        testID="quiz-option"
        disabled
        label="Bonjour"
        onPress={() => {}}
      />,
    );
    const button = interactive.root
      .findAllByProps({testID: 'quiz-option'})
      .find(node => node.props.accessibilityRole === 'button');
    expect(button?.props.disabled).toBe(true);
    expect(button?.props.accessibilityState).toEqual({
      disabled: true,
      selected: false,
      checked: false,
    });
  });
});
