import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {CanonicalBlockView} from '../CanonicalBlockView';
import {SentenceAnalysisPanel} from '../SentenceAnalysisPanel';

async function renderWithTheme(ui: React.ReactElement) {
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

const ANALYSIS = {
  sentence_id: '11111111-1111-4111-8111-111111111101',
  vocabulary: [
    {
      id: '55555555-5555-4555-8555-555555555501',
      word: 'wake up',
      pos: 'verb',
      ipa: 'weɪk ʌp',
      meaning: 'thức dậy',
    },
  ],
  grammar: [
    {
      id: '66666666-6666-4666-8666-666666666601',
      name: 'Present simple',
      description: 'Thói quen.',
      formula: 'S + V',
      analysis: 'Chủ ngữ I.',
    },
  ],
  created_at: '2026-09-30T04:15:00.000Z',
};

describe('SentenceAnalysisPanel', () => {
  it('renders the stored analysis items', async () => {
    const tree = await renderWithTheme(
      <SentenceAnalysisPanel
        sentenceId="s1"
        state={{status: 'ready', analysis: ANALYSIS}}
      />,
    );
    expect(tree.root.findByProps({testID: 'analysis-ready-s1'})).toBeDefined();
    expect(
      tree.root.findByProps({
        testID: 'analysis-vocab-55555555-5555-4555-8555-555555555501',
      }),
    ).toBeDefined();
  });

  it('shows the offline message and the busy retry affordance', async () => {
    const offline = await renderWithTheme(
      <SentenceAnalysisPanel
        sentenceId="s1"
        state={{status: 'offline-missing'}}
      />,
    );
    expect(
      offline.root.findByProps({testID: 'analysis-offline-s1'}),
    ).toBeDefined();

    const onRetry = jest.fn();
    const busy = await renderWithTheme(
      <SentenceAnalysisPanel
        sentenceId="s1"
        state={{status: 'busy'}}
        onRetry={onRetry}
      />,
    );
    expect(busy.root.findByProps({testID: 'analysis-busy-s1'})).toBeDefined();
    await act(async () => {
      busy.root.findByProps({testID: 'analysis-retry-s1'}).props.onPress();
    });
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('CanonicalBlockView activity', () => {
  it('renders an activity read-only with its lines and no submit action', async () => {
    const tree = await renderWithTheme(
      <CanonicalBlockView
        block={{
          id: '77777777-7777-4777-8777-777777777701',
          type: 'activity',
          position: 0,
          title: null,
          data: {
            activityKind: 'listen_and_repeat',
            titleVi: 'Nghe và nhắc lại',
            instructionsVi: 'Đọc to từng câu.',
            lines: [
              {
                id: 'l1',
                speaker: 'a',
                textEn: 'Good morning!',
                textVi: 'Chào buổi sáng!',
              },
            ],
          },
        }}
      />,
    );
    const content = tree.root.findByProps({
      testID: 'canonical-block-activity-content',
    });
    expect(content.props.children).toBe('Nghe và nhắc lại\nĐọc to từng câu.');
    expect(
      tree.root.findAllByProps({testID: 'canonical-block-activity-line-l1'})
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({testID: 'canonical-block-activity-read-only'})
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll(node => typeof node.props.onPress === 'function'),
    ).toHaveLength(0);
  });
});
