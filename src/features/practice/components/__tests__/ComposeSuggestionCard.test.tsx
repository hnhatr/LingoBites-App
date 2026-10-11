import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {ComposeSuggestionCard} from '../ComposeSuggestionCard';

let mockAvailable = true;
let mockOffline = false;
const mockRequestComposeSheet = jest.fn();

jest.mock('@features/lesson/player', () => ({
  requestComposeSheet: (...args: unknown[]) => mockRequestComposeSheet(...args),
  useComposeAvailable: () => mockAvailable,
}));
jest.mock('@core/api/connectivity', () => ({
  useIsOffline: () => mockOffline,
}));

const PICKS = ['s1', 's2', 's3'];

function render(picks: readonly string[] = PICKS) {
  const onOpenLesson = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <ComposeSuggestionCard
            lessonId="lesson-1"
            onOpenLesson={onOpenLesson}
            picks={picks}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, onOpenLesson};
}

const shown = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => node.props.testID === 'practice-compose-suggestion')
    .length > 0;

beforeEach(() => {
  mockAvailable = true;
  mockOffline = false;
  mockRequestComposeSheet.mockClear();
});

describe('ComposeSuggestionCard (plan C)', () => {
  it('returns to the lesson with the suggested sentences ticked', () => {
    const {tree, onOpenLesson} = render();
    expect(shown(tree)).toBe(true);
    act(() => {
      tree.root
        .findAll(
          node =>
            node.props.testID === 'practice-compose-open' &&
            typeof node.props.onPress === 'function',
        )[0]!
        .props.onPress();
    });
    expect(mockRequestComposeSheet).toHaveBeenCalledWith('lesson-1', PICKS);
    expect(onOpenLesson).toHaveBeenCalledTimes(1);
  });

  it('is hidden offline, without compose, or with nothing to suggest', () => {
    mockOffline = true;
    expect(shown(render().tree)).toBe(false);
    mockOffline = false;
    mockAvailable = false;
    expect(shown(render().tree)).toBe(false);
    mockAvailable = true;
    expect(shown(render([]).tree)).toBe(false);
  });
});
