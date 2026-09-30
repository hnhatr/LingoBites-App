import {
  makeEnrichment,
  VIDEO_ID,
} from '../../sentence/__tests__/fixtures/sentenceFixtures';
import {
  buildLessonEnrichmentUrl,
  buildRetryUrl,
  buildSegmentEnrichmentUrl,
  fetchLessonEnrichment,
  fetchSegmentEnrichment,
  retrySentenceBlock,
} from '../sentenceEnrichmentApi';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const response = (
  body: unknown,
  options: {ok?: boolean; status?: number} = {},
) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe('buildRetryUrl', () => {
  it('addresses one segment inside the video-scoped lesson cache', () => {
    expect(buildRetryUrl(VIDEO_ID, 3, 'http://localhost:3000')).toBe(
      'http://localhost:3000/v1/youtube/transcripts/dQw4w9WgXcQ/segments/3/enrichment:retry',
    );
  });
});

describe('buildSegmentEnrichmentUrl', () => {
  it('builds URL for fetching a single segment enrichment', () => {
    expect(
      buildSegmentEnrichmentUrl(VIDEO_ID, 2, 'http://localhost:3000'),
    ).toBe(
      'http://localhost:3000/v1/youtube/transcripts/dQw4w9WgXcQ/segments/2/enrichment',
    );
  });
});

describe('buildLessonEnrichmentUrl', () => {
  it('builds URL for fetching lesson-wide enrichments', () => {
    expect(buildLessonEnrichmentUrl(VIDEO_ID, 'http://localhost:3000')).toBe(
      'http://localhost:3000/v1/youtube/transcripts/dQw4w9WgXcQ/enrichment',
    );
  });
});

describe('fetchSegmentEnrichment', () => {
  it('fetches single segment enrichment and parses successfully', async () => {
    const enrichment = makeEnrichment();
    mockFetch.mockResolvedValueOnce(response(enrichment));

    const result = await fetchSegmentEnrichment(
      {videoId: VIDEO_ID, segmentIndex: 1},
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({ok: true, enrichment});
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/segments/1/enrichment'),
      expect.objectContaining({method: 'GET'}),
    );
  });
});

describe('fetchLessonEnrichment', () => {
  it('fetches whole-lesson enrichments map and parses successfully', async () => {
    const enrichment0 = makeEnrichment({keyWord: 'first'});
    const enrichment1 = makeEnrichment({keyWord: 'second'});
    mockFetch.mockResolvedValueOnce(response({0: enrichment0, 1: enrichment1}));

    const result = await fetchLessonEnrichment(
      {videoId: VIDEO_ID},
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({
      ok: true,
      enrichments: {0: enrichment0, 1: enrichment1},
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/dQw4w9WgXcQ/enrichment'),
      expect.objectContaining({method: 'GET'}),
    );
  });
});

describe('retrySentenceBlock', () => {
  it('retries exactly one block and resolves its enrichment', async () => {
    const enrichment = makeEnrichment();
    mockFetch.mockResolvedValueOnce(response(enrichment));

    const result = await retrySentenceBlock(
      {videoId: VIDEO_ID, segmentIndex: 2, block: 'vocab'},
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({ok: true, enrichment});
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/segments/2/enrichment:retry'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({block: 'vocab'}),
      }),
    );
  });

  it('maps a server error code to its message', async () => {
    mockFetch.mockResolvedValueOnce(
      response(
        {error: {code: 'ENRICHMENT_AI_QUOTA_EXCEEDED', message: 'quota'}},
        {ok: false, status: 429},
      ),
    );

    const result = await retrySentenceBlock(
      {videoId: VIDEO_ID, segmentIndex: 0, block: 'grammar'},
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({
      ok: false,
      message: 'ENRICHMENT_AI_QUOTA_EXCEEDED',
    });
  });

  it('maps a network failure without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const result = await retrySentenceBlock(
      {videoId: VIDEO_ID, segmentIndex: 0, block: 'keyword'},
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({ok: false, message: 'network down'});
  });

  it('rejects a malformed enrichment payload', async () => {
    mockFetch.mockResolvedValueOnce(response({keyWord: 42}));

    const result = await retrySentenceBlock(
      {videoId: VIDEO_ID, segmentIndex: 0, block: 'vocab'},
      mockFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({ok: false, message: 'RETRY_FAILED'});
  });
});
