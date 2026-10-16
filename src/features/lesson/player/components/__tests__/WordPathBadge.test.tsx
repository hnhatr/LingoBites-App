import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {addToReview} from '@features/patternTense';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {getItemMemory} from '@core/sync/learningOutcomes';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {clearWordListCache, lookupWords} from '../../logic/wordListMatches';
import {SentenceAnalysisPanel} from '../SentenceAnalysisPanel';
import {SentenceAnalysisTabs} from '../SentenceAnalysisTabs';

/** Vocab path P6 (F8): words of the learner's own lesson show their level and "Thêm vào lộ trình". */

jest.mock('@features/patternTense', () => ({addToReview: jest.fn()}));
jest.mock('@core/sync/learningOutcomes', () => ({getItemMemory: jest.fn()}));

const mockAdd = addToReview as jest.MockedFunction<typeof addToReview>;
const mockMemory = getItemMemory as jest.MockedFunction<typeof getItemMemory>;
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const BANK = '55555555-5555-4555-8555-555555555501';
const WENT = '55555555-5555-4555-8555-555555555502';
const OTHER = '55555555-5555-4555-8555-555555555503';

const analysis = {
  sentence_id: '11111111-1111-4111-8111-111111111101',
  vocabulary: [
    {id: BANK, word: 'banks', pos: 'noun', ipa: 'bæŋks', meaning: 'ngân hàng'},
    {id: WENT, word: 'went', pos: 'verb', ipa: 'went', meaning: 'đã đi'},
    {id: OTHER, word: 'zzz', pos: 'noun', ipa: 'z', meaning: 'z'},
  ],
  grammar: [],
  created_at: '2026-10-16T04:15:00.000Z',
};

const match = (code: string, cefr: string, meaning: string) => ({
  code,
  kind: 'word',
  text: code.slice(5),
  cefr_level: cefr,
  meaning_vi: meaning,
  part_of_speech: 'n.',
});

function respondLookup() {
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        request_id: 'r',
        status: 'success',
        results: [
          {
            word: 'banks',
            matches: [
              match('word:bank-money', 'A2', 'ngân hàng'),
              match('word:bank-river', 'B1', 'bờ sông'),
            ],
          },
          {word: 'went', matches: [match('word:go', 'A1', 'đi')]},
          {word: 'zzz', matches: []},
        ],
      }),
      {status: 200, headers: {'Content-Type': 'application/json'}},
    ),
  );
}

async function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byId = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll(node => node.props.testID === testID);

function textIn(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const node = byId(tree, testID)[0];
  return node ? [node.props.children].flat().join('') : null;
}

async function pressId(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  const node = byId(tree, testID).find(
    candidate => typeof candidate.props.onPress === 'function',
  )!;
  await act(async () => {
    node.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  clearWordListCache();
  mockMemory.mockReturnValue(null);
  mockAdd.mockResolvedValue({ok: true, alreadyScheduled: false});
});

test('the lookup posts the words with their part of speech', async () => {
  respondLookup();
  const result = await lookupWords([{word: 'banks', pos: 'noun'}]);
  expect(result.ok).toBe(true);
  const [url, init] = mockFetch.mock.calls[0]!;
  expect(url).toMatch(/\/v1\/items\/lookup$/);
  expect(JSON.parse(init.body)).toEqual({
    words: [{word: 'banks', pos: 'noun'}],
  });
});

test("the learner's own lesson shows levels and adds a word to the path", async () => {
  respondLookup();
  const tree = await render(
    <SentenceAnalysisTabs analysis={analysis} sentenceId="s1" wordPath />,
  );
  expect(textIn(tree, `analysis-word-path-${BANK}-level`)).toBe('A2 · B1');
  expect(textIn(tree, `analysis-word-path-${WENT}-level`)).toBe('A1');
  expect(byId(tree, `analysis-word-path-${OTHER}`)).toHaveLength(0);

  await pressId(tree, `analysis-word-path-${WENT}-add`);
  expect(mockAdd).toHaveBeenCalledWith('word:go');
  expect(byId(tree, `analysis-word-path-${WENT}-added`).length).toBeGreaterThan(
    0,
  );
});

test('a word with several senses asks which one first', async () => {
  respondLookup();
  const tree = await render(
    <SentenceAnalysisPanel
      sentenceId="s1"
      state={{status: 'ready', analysis}}
      wordPath
    />,
  );
  await pressId(tree, `analysis-word-path-${BANK}-add`);
  expect(mockAdd).not.toHaveBeenCalled();
  await pressId(tree, `analysis-word-path-${BANK}-sense-word:bank-river`);
  expect(mockAdd).toHaveBeenCalledWith('word:bank-river');
});

test('a scheduled word says it is in the path; offline adding says so', async () => {
  mockMemory.mockImplementation(code =>
    code === 'word:go'
      ? {
          itemCode: 'word:go',
          stage: 1,
          dueAt: '2026-10-20T00:00:00.000Z',
          stableAt: null,
          lastResult: null,
          lastReviewedAt: null,
        }
      : null,
  );
  mockAdd.mockResolvedValue({ok: false, offline: true});
  respondLookup();
  const tree = await render(
    <SentenceAnalysisTabs analysis={analysis} sentenceId="s1" wordPath />,
  );
  expect(byId(tree, `analysis-word-path-${WENT}-added`).length).toBeGreaterThan(
    0,
  );
  await pressId(tree, `analysis-word-path-${BANK}-add`);
  await pressId(tree, `analysis-word-path-${BANK}-sense-word:bank-money`);
  expect(byId(tree, `analysis-word-path-${BANK}-error`).length).toBeGreaterThan(
    0,
  );
});

test('other lessons, and a failed lookup, show no levels', async () => {
  const tree = await render(
    <SentenceAnalysisTabs analysis={analysis} sentenceId="s1" />,
  );
  expect(mockFetch).not.toHaveBeenCalled();
  expect(byId(tree, `analysis-word-path-${BANK}`)).toHaveLength(0);

  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
  const offline = await render(
    <SentenceAnalysisTabs analysis={analysis} sentenceId="s1" wordPath />,
  );
  expect(byId(offline, `analysis-word-path-${BANK}`)).toHaveLength(0);
});
