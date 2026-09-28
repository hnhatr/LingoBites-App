import type {
  LessonPayloadV1,
  SentenceEnrichment,
  YouTubeSegmentV1,
} from '@shared/schemas/sentence-contract';

export const VIDEO_ID = 'dQw4w9WgXcQ';

export function makeEnrichment(
  overrides: Partial<SentenceEnrichment> = {},
): SentenceEnrichment {
  return {
    keyWord: 'learning',
    vocab: [
      {
        word: 'learning',
        pos: 'noun',
        ipa: 'ˈlɜːnɪŋ',
        meaning: 'sự học',
        tip: 'learn + ing',
      },
      {
        word: 'through',
        pos: 'từ chức năng',
        ipa: 'θruː',
        meaning: 'qua, xuyên qua',
        inSentenceNote: 'Trong câu: học qua video',
      },
    ],
    grammar: [
      {
        name: 'Present continuous',
        description: 'diễn tả hành động đang xảy ra',
        formula: 'S + am/is/are + V-ing',
        analysis: '“are learning” diễn tả việc đang học ngay lúc nói',
      },
    ],
    status: 'ready',
    ...overrides,
  };
}

export function makeSegment(
  overrides: Partial<YouTubeSegmentV1> = {},
): YouTubeSegmentV1 {
  return {
    index: 0,
    start_ms: 1000,
    end_ms: 4000,
    en: 'We are learning through video',
    vi: 'Chúng ta đang học qua video',
    ipa: 'wiː ɑːr ˈlɜːnɪŋ θruː ˈvɪdioʊ',
    enrichment: makeEnrichment(),
    ...overrides,
  };
}

/** Sample-video lesson: every field filled, every block ready. */
export function makeLessonPayload(
  segments: YouTubeSegmentV1[] = [makeSegment()],
): LessonPayloadV1 {
  return {
    videoId: VIDEO_ID,
    duration_ms: 120_000,
    level: 'A2',
    segments,
  };
}

/** Partial sentence: translation exists, vocab/grammar missing, no error. */
export function makePartialSegment(): YouTubeSegmentV1 {
  return makeSegment({
    enrichment: makeEnrichment({
      keyWord: null,
      vocab: [],
      grammar: [],
      status: 'partial',
    }),
  });
}

/** Failed sentence: blocks missing with a retryable error. */
export function makeFailedSegment(): YouTubeSegmentV1 {
  return makeSegment({
    enrichment: makeEnrichment({
      keyWord: null,
      vocab: [],
      grammar: [],
      status: 'failed',
      error: 'ENRICHMENT_FAILED',
    }),
  });
}

describe('sentenceFixtures', () => {
  it('exports test data fixtures', () => {
    expect(makeEnrichment().status).toBe('ready');
    expect(makeSegment().en).not.toBe('');
    expect(makeLessonPayload().segments).toHaveLength(1);
    expect(makePartialSegment().enrichment.status).toBe('partial');
    expect(makeFailedSegment().enrichment.status).toBe('failed');
  });
});
