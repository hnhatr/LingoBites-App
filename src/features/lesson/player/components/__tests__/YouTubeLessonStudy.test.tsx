import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import vi from '@core/i18n/vi.json';
import {FeatureFlagProvider} from '@core/release';
import type {LessonSnapshot} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {YouTubeLessonStudy} from '../YouTubeLessonStudy';

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

function snapshotWithSentenceCount(count: number): LessonSnapshot {
  const items = Array.from({length: count}, (_, index) =>
    sentence(`11111111-1111-4111-8111-11111111110${index + 1}`, index, {
      start: index * 2000,
      end: index * 2000 + 2000,
    }),
  );
  return {
    id: '33333333-3333-4333-8333-333333333301',
    slug: 'yt-lesson',
    title: 'How to order coffee in English',
    description: '',
    origin: 'learner',
    source_type: 'youtube',
    content_revision: 3,
    unit: null,
    youtube: {video_id: 'dQw4w9WgXcQ', duration_ms: 60000},
    sentences: items,
    blocks: [],
    analyses: {},
  };
}

async function renderStudy(
  props: Partial<React.ComponentProps<typeof YouTubeLessonStudy>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const snapshot = props.snapshot ?? snapshotWithSentenceCount(3);
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <YouTubeLessonStudy
            snapshot={snapshot}
            analyses={{}}
            playbackPositionMs={0}
            videoAvailable
            videoSlot={<React.Fragment />}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function pressByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  const target = root
    .findAll(node => node.props.testID === testID)
    .find(node => typeof node.props.onPress === 'function');
  if (!target) {
    throw new Error(`No pressable for ${testID}`);
  }
  act(() => {
    target.props.onPress();
  });
}

describe('YouTubeLessonStudy', () => {
  it('shows sentence indicator and three cards (AC-005 S1)', async () => {
    const tree = await renderStudy();
    expect(
      tree.root.findByProps({testID: 'youtube-sentence-indicator'}).props
        .children,
    ).toBe(
      vi.lessonPlayer.sentence_counter
        .replace('{{index}}', '1')
        .replace('{{total}}', '3'),
    );
    const cardIds = new Set(
      tree.root
        .findAll(
          node =>
            typeof node.props.testID === 'string' &&
            node.props.testID.startsWith('canonical-sentence-'),
        )
        .map(node => node.props.testID as string),
    );
    expect(cardIds.size).toBe(3);
  });

  it('moves indicator on next and disables prev on first card (AC-005 S2)', async () => {
    const tree = await renderStudy();
    const prevInitial = tree.root.findByProps({testID: 'youtube-cards-prev'});
    expect(prevInitial.props.disabled).toBe(true);
    pressByTestId(tree.root, 'youtube-cards-next');
    expect(
      tree.root.findByProps({testID: 'youtube-sentence-indicator'}).props
        .children,
    ).toContain('2/3');
    expect(
      tree.root.findByProps({testID: 'youtube-cards-prev'}).props.disabled,
    ).toBe(false);
    pressByTestId(tree.root, 'youtube-cards-next');
    pressByTestId(tree.root, 'youtube-cards-next');
    expect(
      tree.root.findByProps({testID: 'youtube-cards-next'}).props.disabled,
    ).toBe(true);
  });

  it('shows overlay for active cue and clears outside cues (AC-005 S4)', async () => {
    const snapshot = snapshotWithSentenceCount(2);
    const inside = await renderStudy({
      snapshot,
      playbackPositionMs: 2500,
    });
    expect(
      inside.root.findByProps({testID: 'youtube-video-overlay'}).props.children,
    ).toBe('Sentence 1 en.');

    const outside = await renderStudy({
      snapshot,
      playbackPositionMs: 99999,
    });
    expect(
      outside.root.findAll(
        node => node.props.testID === 'youtube-video-overlay',
      ),
    ).toHaveLength(0);
  });

  it('calls onSeek on card tap without seeking video (AC-005 S5)', async () => {
    const onSeek = jest.fn();
    const tree = await renderStudy({onSeek, playbackPositionMs: 0});
    const cue = tree.root.findByProps({
      testID: 'youtube-cue-11111111-1111-4111-8111-111111111102',
    });
    await act(async () => {
      cue.props.onPress();
    });
    expect(onSeek).toHaveBeenCalledWith(2000);
  });

  it('shows empty cards message when there are no sentences (AC-005 S7)', async () => {
    const tree = await renderStudy({
      snapshot: snapshotWithSentenceCount(0),
    });
    expect(
      tree.root.findByProps({testID: 'youtube-cards-empty'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'youtube-cards-prev'}).props.disabled,
    ).toBe(true);
  });

  it('renders unavailable notice and retry (AC-011 S1)', async () => {
    const onRetryVideo = jest.fn();
    const tree = await renderStudy({
      videoAvailable: false,
      onRetryVideo,
    });
    expect(
      tree.root.findByProps({testID: 'youtube-timeline-unavailable'}),
    ).toBeDefined();
    pressByTestId(tree.root, 'youtube-video-retry');
    expect(onRetryVideo).toHaveBeenCalledTimes(1);
  });

  it('highlights active cue testID for E-013 (AC-013)', async () => {
    const tree = await renderStudy({playbackPositionMs: 500});
    expect(
      tree.root.findByProps({
        testID: 'youtube-cue-11111111-1111-4111-8111-111111111101-active',
      }),
    ).toBeDefined();
  });
});
