import {
  isPublishable,
  pickKeyword,
  type LessonPayloadV1,
  type YouTubeSegmentV1,
} from '../sentence-contract';

function makeSegment(
  overrides: Partial<YouTubeSegmentV1> = {},
): YouTubeSegmentV1 {
  return {
    index: 0,
    start_ms: 0,
    end_ms: 1000,
    en: 'Hello world',
    vi: 'Xin chào thế giới',
    ipa: 'həˈloʊ wɜːrld',
    enrichment: {
      keyWord: 'Hello',
      vocab: [{word: 'hello', pos: 'verb', ipa: 'həˈloʊ', meaning: 'xin chào'}],
      grammar: [
        {
          name: 'Simple present',
          description: 'mô tả',
          formula: 'S + V',
          analysis: 'phân tích',
        },
      ],
      status: 'ready',
    },
    ...overrides,
  };
}

function makePayload(segments: YouTubeSegmentV1[]): LessonPayloadV1 {
  return {videoId: 'dQw4w9WgXcQ', duration_ms: 120_000, segments};
}

describe('isPublishable', () => {
  it('publishes a lesson where every sentence has EN + VI', () => {
    expect(isPublishable(makePayload([makeSegment()]))).toBe(true);
  });

  it('withholds a lesson with an empty segment list', () => {
    expect(isPublishable(makePayload([]))).toBe(false);
  });

  it.each([
    ['missing EN', {en: '   '}],
    ['missing VI', {vi: ''}],
    ['missing both', {en: '', vi: '  '}],
  ])('withholds a lesson when a sentence has %s', (_label, override) => {
    expect(isPublishable(makePayload([makeSegment(override)]))).toBe(false);
  });

  it('withholds when any one of several sentences misses VI', () => {
    expect(
      isPublishable(
        makePayload([makeSegment(), makeSegment({index: 1, vi: ''})]),
      ),
    ).toBe(false);
  });

  it('publishes a partial lesson: vocab/grammar may be missing', () => {
    expect(
      isPublishable(
        makePayload([
          makeSegment({
            enrichment: {
              keyWord: null,
              vocab: [],
              grammar: [],
              status: 'partial',
            },
          }),
        ]),
      ),
    ).toBe(true);
  });
});

describe('pickKeyword', () => {
  it('prefers the AI keyword when present', () => {
    expect(pickKeyword('Hello world', 'world')).toBe('world');
  });

  it('falls back to the longest content word when AI returns null', () => {
    expect(pickKeyword('I am learning English today', null)).toBe('learning');
  });

  it('falls back when the AI keyword is an empty string', () => {
    expect(pickKeyword('Hello world', '')).toBe('Hello');
  });

  it('skips function words case-insensitively', () => {
    expect(pickKeyword('The cat is on the table', null)).toBe('table');
  });

  it('falls back to the first word when every word is a function word', () => {
    expect(pickKeyword('To be', null)).toBe('To');
  });

  it('returns an empty string when there is no word at all', () => {
    expect(pickKeyword('…', null)).toBe('');
  });
});
