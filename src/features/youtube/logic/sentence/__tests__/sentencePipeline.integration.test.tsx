import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {AppText} from '@ui/components/AppText';
import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {
  isPublishable,
  type LessonPayloadV1,
} from '@core/schemas/sentence-contract';

import {SentenceCard} from '../../../components/SentenceCard';
import type {RetryBlockFn} from '../useSentenceEnrichment';
import {
  makeEnrichment,
  makeFailedSegment,
  makeLessonPayload,
  makePartialSegment,
  VIDEO_ID,
} from './fixtures/sentenceFixtures';

function renderLessonCards(
  payload: LessonPayloadV1,
  retryBlock?: RetryBlockFn,
) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <>
            {payload.segments.map(segment => (
              <SentenceCard
                key={segment.index}
                enrichment={segment.enrichment}
                retryBlock={retryBlock}
                segment={segment}
                testID={`lesson-card-${segment.index}`}
                videoId={payload.videoId}
              />
            ))}
          </>
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function cardTexts(
  tree: renderer.ReactTestRenderer,
  cardId: string,
): unknown[] {
  return tree.root
    .findByProps({testID: cardId})
    .findAllByType(AppText)
    .map(node => node.props.children);
}

function hasNode(tree: renderer.ReactTestRenderer, testID: string): boolean {
  try {
    tree.root.findByProps({testID});
    return true;
  } catch {
    return false;
  }
}

describe('sentence pipeline integration (SETE-329 acceptance)', () => {
  it('a sample video with full fields publishes and renders every block', () => {
    const payload = makeLessonPayload();

    expect(isPublishable(payload)).toBe(true);

    const tree = renderLessonCards(payload);
    const texts = cardTexts(tree, 'lesson-card-0');
    expect(texts).toContain('We are learning through video');
    expect(texts).toContain('learning');
    expect(hasNode(tree, 'lesson-card-0-block-vocab-value')).toBe(true);
    expect(hasNode(tree, 'lesson-card-0-block-grammar-value')).toBe(true);
  });

  it('a partial sentence still renders: EN + fallback keyword, short card', () => {
    const payload = makeLessonPayload([makePartialSegment()]);

    // EN + VI present, so the lesson stays publishable without vocab/grammar.
    expect(isPublishable(payload)).toBe(true);

    const tree = renderLessonCards(payload);
    const texts = cardTexts(tree, 'lesson-card-0');
    expect(texts).toContain('We are learning through video');
    expect(texts).toContain('learning');
    expect(hasNode(tree, 'lesson-card-0-block-vocab-value')).toBe(false);
    expect(hasNode(tree, 'lesson-card-0-block-vocab-error')).toBe(false);
    expect(hasNode(tree, 'lesson-card-0-block-grammar-value')).toBe(false);
    expect(hasNode(tree, 'lesson-card-0-block-grammar-error')).toBe(false);
  });

  it('per-block retry recovers a failed card block by block', async () => {
    const payload = makeLessonPayload([makeFailedSegment()]);
    const retryBlock: RetryBlockFn = jest
      .fn()
      .mockImplementation(async ({block}) => {
        if (block === 'vocab') {
          return {
            ok: true,
            enrichment: makeEnrichment({
              keyWord: null,
              grammar: [],
              status: 'failed',
              error: 'ENRICHMENT_FAILED',
            }),
          };
        }
        return {
          ok: true,
          enrichment: makeEnrichment({keyWord: null, status: 'ready'}),
        };
      });
    const tree = renderLessonCards(payload, retryBlock);

    expect(hasNode(tree, 'lesson-card-0-block-vocab-error')).toBe(true);

    await act(async () => {
      tree.root
        .findByProps({testID: 'lesson-card-0-block-vocab-error-retry'})
        .props.onPress();
    });

    // Vocab recovered; grammar still failed until its own retry.
    expect(hasNode(tree, 'lesson-card-0-block-vocab-value')).toBe(true);
    expect(hasNode(tree, 'lesson-card-0-block-grammar-error')).toBe(true);

    await act(async () => {
      tree.root
        .findByProps({testID: 'lesson-card-0-block-grammar-error-retry'})
        .props.onPress();
    });

    expect(hasNode(tree, 'lesson-card-0-block-grammar-value')).toBe(true);
    expect(retryBlock).toHaveBeenCalledTimes(2);
    expect(retryBlock).toHaveBeenNthCalledWith(1, {
      videoId: VIDEO_ID,
      segmentIndex: 0,
      block: 'vocab',
    });
    expect(retryBlock).toHaveBeenNthCalledWith(2, {
      videoId: VIDEO_ID,
      segmentIndex: 0,
      block: 'grammar',
    });
  });
});
