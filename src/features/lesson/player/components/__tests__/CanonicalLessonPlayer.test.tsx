import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {LessonSnapshot} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {CanonicalLessonPlayer} from '../CanonicalLessonPlayer';

function sentence(
  id: string,
  position: number,
  cues?: {start: number; end: number},
) {
  return {
    id,
    position,
    text_en: `Sentence ${position} en.`,
    text_vi: `Câu ${position} vi.`,
    ipa: `ipa-${position}`,
    start_ms: cues ? cues.start : null,
    end_ms: cues ? cues.end : null,
  };
}

function snapshotOf(source: LessonSnapshot['source_type']): LessonSnapshot {
  const youtube = source === 'youtube';
  return {
    id: '33333333-3333-4333-8333-333333333301',
    slug: 'test-lesson',
    title: 'Test lesson',
    description: '',
    origin: youtube ? 'learner' : 'admin',
    source_type: source,
    content_revision: 3,
    unit: null,
    youtube: youtube ? {video_id: 'dQw4w9WgXcQ', duration_ms: 60000} : null,
    sentences: [
      sentence(
        '11111111-1111-4111-8111-111111111101',
        0,
        youtube ? {start: 0, end: 2000} : undefined,
      ),
      sentence(
        '11111111-1111-4111-8111-111111111102',
        1,
        youtube ? {start: 2000, end: 5000} : undefined,
      ),
    ],
    blocks: [
      {
        id: '22222222-2222-4222-8222-222222222201',
        type: 'text',
        position: 0,
        title: 'Warm up',
        data: {content: 'Read aloud.'},
      },
      {
        id: '22222222-2222-4222-8222-222222222202',
        type: 'item_cards',
        position: 1,
        title: null,
        data: {item_ids: ['44444444-4444-4444-8444-444444444401']},
      },
    ],
    analyses: {
      '11111111-1111-4111-8111-111111111101': {
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
      },
    },
  };
}

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

describe('CanonicalLessonPlayer', () => {
  it.each(['admin_text', 'learner_text', 'learner_ocr', 'youtube'] as const)(
    'opens the %s source in the same player',
    async source => {
      const tree = await renderWithTheme(
        <CanonicalLessonPlayer snapshot={snapshotOf(source)} analyses={{}} />,
      );
      expect(tree.root.findByProps({testID: 'canonical-player'})).toBeDefined();
      if (source === 'youtube') {
        expect(
          tree.root.findAll(
            node => node.props.testID === 'canonical-player-title',
          ),
        ).toHaveLength(0);
      } else {
        expect(
          tree.root.findByProps({testID: 'canonical-player-title'}).props
            .children,
        ).toBe('Test lesson');
      }
    },
  );

  it('renders sentences with EN/VI/IPA and the kept block types', async () => {
    const tree = await renderWithTheme(
      <CanonicalLessonPlayer
        snapshot={snapshotOf('admin_text')}
        analyses={{}}
      />,
    );
    expect(
      tree.root.findByProps({
        testID: 'canonical-sentence-11111111-1111-4111-8111-111111111101',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'canonical-block-text'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'canonical-block-item_cards'}),
    ).toBeDefined();
  });

  it('shows the offline analysis message when offline without analysis', async () => {
    const tree = await renderWithTheme(
      <CanonicalLessonPlayer
        snapshot={snapshotOf('learner_text')}
        analyses={{}}
        offline
      />,
    );
    expect(
      tree.root.findByProps({
        testID: 'analysis-offline-11111111-1111-4111-8111-111111111101',
      }),
    ).toBeDefined();
  });

  it('offers analysis online with retry after a failure', async () => {
    const onRetry = jest.fn();
    const tree = await renderWithTheme(
      <CanonicalLessonPlayer
        snapshot={snapshotOf('learner_text')}
        analyses={{}}
        onRetryAnalysis={onRetry}
        analysisStates={{
          '11111111-1111-4111-8111-111111111101': {
            status: 'failed',
            retryable: true,
            message: 'Analysis failed.',
          },
        }}
      />,
    );
    const retry = tree.root.findByProps({
      testID: 'analysis-retry-11111111-1111-4111-8111-111111111101',
    });
    await act(async () => {
      retry.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111101',
    );
  });

  it('highlights the active YouTube cue and seeks on tap', async () => {
    const onSeek = jest.fn();
    const tree = await renderWithTheme(
      <CanonicalLessonPlayer
        snapshot={snapshotOf('youtube')}
        analyses={{}}
        playbackPositionMs={1500}
        onSeek={onSeek}
      />,
    );
    expect(
      tree.root.findByProps({
        testID: 'youtube-cue-11111111-1111-4111-8111-111111111101-active',
      }),
    ).toBeDefined();
    const firstCue = tree.root.findByProps({
      testID: 'youtube-cue-11111111-1111-4111-8111-111111111101-active',
    });
    await act(async () => {
      firstCue.props.onPress();
    });
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('renders the unavailable-video state without highlight or seek', async () => {
    const tree = await renderWithTheme(
      <CanonicalLessonPlayer
        snapshot={snapshotOf('youtube')}
        analyses={{}}
        videoAvailable={false}
      />,
    );
    expect(
      tree.root.findByProps({testID: 'youtube-timeline-unavailable'}),
    ).toBeDefined();
  });

  it('shows the update marker and the archived state', async () => {
    const withUpdate = await renderWithTheme(
      <CanonicalLessonPlayer
        snapshot={snapshotOf('admin_text')}
        analyses={{}}
        hasUpdate
      />,
    );
    expect(
      withUpdate.root.findByProps({testID: 'canonical-player-update'}),
    ).toBeDefined();

    const archived = await renderWithTheme(
      <CanonicalLessonPlayer
        snapshot={snapshotOf('admin_text')}
        analyses={{}}
        archived
      />,
    );
    expect(
      archived.root.findByProps({testID: 'canonical-player-archived'}),
    ).toBeDefined();
  });
});
