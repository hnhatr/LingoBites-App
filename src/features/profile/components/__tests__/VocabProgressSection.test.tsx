import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support/appNavigationMock';

import {clearVocabProgress} from '../../logic/vocabProgressClient';
import {VocabProgressSection} from '../VocabProgressSection';

/** Vocab path P6 (F9): words, patterns and tenses in the progress report. */

jest.mock('@core/navigation', () => ({
  ...jest.requireActual('@core/navigation'),
  useOptionalAppNavigation: () =>
    require('@test/support/appNavigationMock').mockAppNavigation,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const progress = {
  request_id: 'r',
  status: 'success',
  words: [
    {cefr_level: 'A1', total: 899, learning: 40, stable: 120},
    {cefr_level: 'A2', total: 872, learning: 5, stable: 3},
  ],
  patterns: [
    {
      function: 'function:emphasis',
      label_vi: 'Nhấn mạnh',
      total: 4,
      learning: 1,
      stable: 2,
    },
  ],
  pattern_summary: {total: 25, learning: 3, stable: 2},
  tenses: [
    {
      code: 'grammar:past-simple',
      text: 'Past simple',
      time: 'past',
      aspect: 'simple',
      stage: 4,
      stable: true,
    },
    {
      code: 'grammar:present-perfect',
      text: 'Present perfect',
      time: 'present',
      aspect: 'perfect',
      stage: null,
      stable: false,
    },
  ],
};

function respond(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: {'Content-Type': 'application/json'},
    }),
  );
}

async function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <VocabProgressSection />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byId = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll(node => node.props.testID === testID);

function text(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object' && 'props' in value) {
      walk((value as {props: {children?: unknown}}).props.children);
    }
  };
  // The first match may be the component that only passes the id down.
  return byId(tree, testID)
    .map(node => {
      parts.length = 0;
      walk(node.props.children);
      return parts.join('');
    })
    .reduce(
      (longest, value) => (value.length > longest.length ? value : longest),
      '',
    );
}

function press(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const node = byId(tree, testID).find(
    candidate => typeof candidate.props.onPress === 'function',
  )!;
  act(() => node.props.onPress());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  clearVocabProgress();
});

test('shows words by level, patterns by function and the tense grid', async () => {
  respond(200, progress);
  const tree = await render();
  expect(text(tree, 'vocab-progress-words')).toBe('123 / 1771 từ');
  expect(text(tree, 'vocab-progress-level-A1')).toContain('120/899');
  expect(text(tree, 'vocab-progress-patterns')).toBe('2 / 25 mẫu');
  expect(text(tree, 'vocab-progress-function-function:emphasis')).toContain(
    'Nhấn mạnh',
  );
  press(tree, 'vocab-progress-tense-grammar:present-perfect');
  expect(mockAppNavigation.openTenseDetail).toHaveBeenCalledWith(
    'grammar:present-perfect',
  );
  press(tree, 'vocab-progress-tense-map');
  expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith('tenses');
});

test('offline the first time it offers a retry; the session keeps the last answer', async () => {
  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
  const offline = await render();
  expect(text(offline, 'vocab-progress-status')).toBe(
    'Cần mạng để xem tiến độ từ vựng.',
  );
  respond(200, progress);
  await act(async () => {
    byId(offline, 'vocab-progress-retry')
      .find(node => typeof node.props.onPress === 'function')!
      .props.onPress();
  });
  expect(text(offline, 'vocab-progress-words')).toBe('123 / 1771 từ');

  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
  const again = await render();
  expect(text(again, 'vocab-progress-words')).toBe('123 / 1771 từ');
});

test('without tenses the grid is left out', async () => {
  respond(200, {...progress, tenses: []});
  const tree = await render();
  expect(byId(tree, 'vocab-progress-tense-map')).toHaveLength(0);
});
