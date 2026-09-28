import {
  deriveBlockState,
  deriveBlockStates,
  isPartialCard,
  resolveKeyword,
  resolveVocab,
} from '../sentencePipeline';
import type {SentenceEnrichment} from '@shared/schemas/sentence-contract';

function makeEnrichment(
  overrides: Partial<SentenceEnrichment> = {},
): SentenceEnrichment {
  return {
    keyWord: 'learning',
    vocab: [{word: 'learn', pos: 'verb', ipa: 'lɜːn', meaning: 'học'}],
    grammar: [
      {
        name: 'Present continuous',
        description: 'mô tả',
        formula: 'S + am/is/are + V-ing',
        analysis: 'phân tích',
      },
    ],
    status: 'ready',
    ...overrides,
  };
}

describe('deriveBlockStates', () => {
  it('marks every block pending when enrichment is absent (skeleton)', () => {
    expect(deriveBlockStates(null)).toEqual({
      keyword: 'pending',
      vocab: 'pending',
      grammar: 'pending',
    });
  });

  it('marks every block ready when enrichment is complete', () => {
    expect(deriveBlockStates(makeEnrichment())).toEqual({
      keyword: 'ready',
      vocab: 'ready',
      grammar: 'ready',
    });
  });

  it('keeps the keyword block ready on null AI keyword (fallback covers it)', () => {
    expect(
      deriveBlockStates(makeEnrichment({keyWord: null, status: 'partial'})),
    ).toMatchObject({keyword: 'ready'});
  });

  it('omits missing vocab/grammar on a partial sentence (short card, no error)', () => {
    expect(
      deriveBlockStates(
        makeEnrichment({vocab: [], grammar: [], status: 'partial'}),
      ),
    ).toEqual({keyword: 'ready', vocab: 'omitted', grammar: 'omitted'});
  });

  it('omits a missing block on a ready sentence too', () => {
    expect(
      deriveBlockStates(makeEnrichment({grammar: [], status: 'ready'})),
    ).toMatchObject({grammar: 'omitted', vocab: 'ready'});
  });

  it('keeps missing blocks pending while the sentence is still pending', () => {
    expect(
      deriveBlockStates(
        makeEnrichment({vocab: [], grammar: [], status: 'pending'}),
      ),
    ).toMatchObject({vocab: 'pending', grammar: 'pending'});
  });

  it('fails missing blocks when the sentence failed (retryable)', () => {
    expect(
      deriveBlockStates(
        makeEnrichment({
          vocab: [],
          grammar: [],
          status: 'failed',
          error: 'ENRICHMENT_FAILED',
        }),
      ),
    ).toMatchObject({vocab: 'failed', grammar: 'failed'});
  });

  it('lets a per-block fetch error force that block to failed', () => {
    const states = deriveBlockStates(makeEnrichment(), {vocab: 'boom'});
    expect(states).toMatchObject({
      keyword: 'ready',
      vocab: 'failed',
      grammar: 'ready',
    });
  });

  it('fills progressively: vocab ready while grammar still pending', () => {
    expect(
      deriveBlockState(
        'grammar',
        makeEnrichment({grammar: [], status: 'pending'}),
      ),
    ).toBe('pending');
    expect(deriveBlockState('vocab', makeEnrichment({status: 'pending'}))).toBe(
      'ready',
    );
  });
});

describe('resolveKeyword / resolveVocab', () => {
  it('resolves the AI keyword when present', () => {
    expect(resolveKeyword('I am learning English', makeEnrichment())).toBe(
      'learning',
    );
  });

  it('resolves the fallback keyword from segment.en when AI is null', () => {
    expect(
      resolveKeyword(
        'I am learning English today',
        makeEnrichment({keyWord: null, status: 'partial'}),
      ),
    ).toBe('learning');
  });

  it('resolves the fallback keyword when enrichment is absent', () => {
    expect(resolveKeyword('Hello world', null)).toBe('Hello');
  });

  it('resolves vocab rows, defaulting to empty', () => {
    expect(resolveVocab(makeEnrichment())).toHaveLength(1);
    expect(resolveVocab(null)).toEqual([]);
  });
});

describe('isPartialCard', () => {
  it('detects a short card when any block is omitted', () => {
    expect(
      isPartialCard({keyword: 'ready', vocab: 'omitted', grammar: 'ready'}),
    ).toBe(true);
  });

  it('is false for full, loading, and failed cards', () => {
    expect(
      isPartialCard({keyword: 'ready', vocab: 'ready', grammar: 'ready'}),
    ).toBe(false);
    expect(
      isPartialCard({keyword: 'pending', vocab: 'pending', grammar: 'pending'}),
    ).toBe(false);
    expect(
      isPartialCard({keyword: 'ready', vocab: 'failed', grammar: 'ready'}),
    ).toBe(false);
  });
});
