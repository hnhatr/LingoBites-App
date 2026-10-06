import fs from 'node:fs';
import path from 'node:path';

import {getAppConfig} from '@core/api/appConfig';

import {
  fetchLessonCatalog,
  fetchLessonRevisions,
  fetchLessonSnapshot,
  fetchSentenceAnalysis,
  submitLessonCreation,
} from '../canonicalLessonClient';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));

const {authenticatedFetch} = jest.requireMock(
  '@core/api/authenticatedFetch',
) as {
  authenticatedFetch: jest.Mock;
};

const mockedConfig = getAppConfig as jest.Mock;

function fixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        'core',
        'schemas',
        '__tests__',
        'fixtures',
        name,
      ),
      'utf8',
    ),
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedConfig.mockReturnValue({apiBaseUrl: 'https://api.example'});
});

describe('canonical lesson client', () => {
  it('sends the origin and source type narrowing on the catalog request', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {contract_version: 1, lessons: [], next_cursor: null}),
    );
    await fetchLessonCatalog({
      limit: 20,
      origin: 'admin',
      sourceType: 'youtube',
    });
    const url = String(authenticatedFetch.mock.calls[0][0]);
    expect(url).toContain('/api/v1/lessons?');
    expect(url).toContain('limit=20');
    expect(url).toContain('origin=admin');
    expect(url).toContain('source_type=youtube');
  });

  it('leaves the catalog request unchanged without narrowing', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {contract_version: 1, lessons: [], next_cursor: null}),
    );
    await fetchLessonCatalog({limit: 20});
    const url = String(authenticatedFetch.mock.calls[0][0]);
    expect(url).not.toContain('origin=');
    expect(url).not.toContain('source_type=');
  });

  it('parses the snapshot fixture through the strict mirror', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, fixture('valid-lesson-snapshot-response.json')),
    );
    const result = await fetchLessonSnapshot(
      '33333333-3333-4333-8333-333333333301',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.snapshot.sentences.length).toBeGreaterThan(0);
      expect(result.value.rawBody).toBeDefined();
    }
  });

  it('maps 404 LESSON_NOT_FOUND to not-found without retry', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(404, {
        error: {code: 'LESSON_NOT_FOUND', message: 'Lesson was not found.'},
      }),
    );
    const result = await fetchLessonSnapshot(
      '33333333-3333-4333-8333-333333333301',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('not-found');
      expect(result.retryable).toBe(false);
    }
  });

  it('maps 503 ANALYSIS_BUSY to a retryable busy state', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(503, {
        error: {code: 'ANALYSIS_BUSY', message: 'Generating.'},
      }),
    );
    const result = await fetchSentenceAnalysis('lesson-id', 'sentence-id');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('analysis-busy');
      expect(result.retryable).toBe(true);
    }
  });

  it('maps 409 IDEMPOTENCY_CONFLICT on creation submit', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Same key, body differs.',
        },
      }),
    );
    const result = await submitLessonCreation(
      {source: 'text', text: 'Hello world.'},
      '11111111-1111-4111-8111-111111111111',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('idempotency-conflict');
      expect(result.retryable).toBe(false);
    }
  });

  it('sends the persisted Idempotency-Key header on creation submit', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(202, {
        contract_version: 1,
        request: {id: '22222222-2222-4222-8222-222222222222', status: 'queued'},
      }),
    );
    const key = '11111111-1111-4111-8111-111111111111';
    const result = await submitLessonCreation(
      {source: 'text', text: 'Hi.'},
      key,
    );
    expect(result.ok).toBe(true);
    const [, init] = authenticatedFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      key,
    );
  });

  it('never reports a deletion on transport failure (gone needs HTTP 200)', async () => {
    authenticatedFetch.mockRejectedValue(new Error('offline'));
    const result = await fetchLessonRevisions([
      '33333333-3333-4333-8333-333333333301',
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('network-error');
      expect(result.retryable).toBe(true);
    }
  });
});
