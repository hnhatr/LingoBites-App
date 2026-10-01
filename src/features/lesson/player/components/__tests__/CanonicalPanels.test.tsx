import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {SentenceAnalysisPanel} from '../SentenceAnalysisPanel';
import {YouTubeTimeline} from '../YouTubeTimeline';

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

describe('YouTubeTimeline', () => {
  const sentences = [
    {
      id: 's1',
      position: 0,
      text_en: 'Hello.',
      text_vi: 'Xin chào.',
      ipa: 'x',
      start_ms: 0,
      end_ms: 2000,
    },
    {
      id: 's2',
      position: 1,
      text_en: 'World.',
      text_vi: 'Thế giới.',
      ipa: 'y',
      start_ms: 2000,
      end_ms: 5000,
    },
  ];

  it('highlights the active cue and seeks on press', async () => {
    const onSeek = jest.fn();
    const tree = await renderWithTheme(
      <YouTubeTimeline
        sentences={sentences}
        positionMs={2500}
        videoAvailable
        onSeek={onSeek}
      />,
    );
    expect(
      tree.root.findByProps({testID: 'youtube-cue-s2-active'}),
    ).toBeDefined();
    await act(async () => {
      tree.root.findByProps({testID: 'youtube-cue-s1'}).props.onPress();
    });
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('renders the unavailable state when the video cannot load', async () => {
    const tree = await renderWithTheme(
      <YouTubeTimeline
        sentences={sentences}
        positionMs={0}
        videoAvailable={false}
        unavailableReason="Not embeddable."
      />,
    );
    expect(
      tree.root.findByProps({testID: 'youtube-timeline-unavailable'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'youtube-timeline-unavailable-text'}).props
        .children,
    ).toBe('Not embeddable.');
  });
});
