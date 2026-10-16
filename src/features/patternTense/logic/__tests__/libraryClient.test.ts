import {catalogItem} from '@test/support/catalogItemFixture';

import {
  fetchPatternLibrary,
  fetchTenseLibrary,
  learnItems,
} from '../libraryClient';

/** Vocab path P6: the library client checks what the Server sends and reports failures as values. */

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function respond(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: {'Content-Type': 'application/json'},
    }),
  );
}

beforeEach(() => mockFetch.mockReset());

test('the pattern library parses patterns with their level, tags and filters', async () => {
  respond(200, {
    request_id: 'r',
    status: 'success',
    patterns: [
      {
        item: catalogItem('pattern:worth', 'pattern', 'It is worth {x}'),
        cefr_level: 'B2',
        tags: ['function:emphasis'],
      },
    ],
    functions: [{code: 'function:emphasis', label_vi: 'Nhấn mạnh'}],
    exams: [],
  });
  const result = await fetchPatternLibrary();
  expect(result.ok && result.value.patterns[0]!.cefr_level).toBe('B2');
  expect(mockFetch.mock.calls[0]![0]).toMatch(/\/v1\/library\/patterns$/);
});

test('the tense library parses tenses with their grid place', async () => {
  respond(200, {
    request_id: 'r',
    status: 'success',
    tenses: [
      {
        item: catalogItem('grammar:past-simple', 'grammar', 'Past simple'),
        time: 'past',
        aspect: 'simple',
      },
    ],
  });
  const result = await fetchTenseLibrary();
  expect(result.ok && result.value.tenses[0]!.time).toBe('past');
});

test('learning items posts the codes and returns the items', async () => {
  respond(200, {
    request_id: 'r',
    status: 'success',
    enrolled: 1,
    already_scheduled: 0,
    items: [catalogItem('pattern:worth', 'pattern', 'It is worth {x}')],
  });
  const result = await learnItems(['pattern:worth']);
  expect(result.ok && result.value.enrolled).toBe(1);
  const [url, init] = mockFetch.mock.calls[0]!;
  expect(url).toMatch(/\/v1\/items\/learn$/);
  expect(JSON.parse(init.body)).toEqual({item_codes: ['pattern:worth']});
});

test('a malformed answer or a server error comes back as a failure', async () => {
  respond(200, {request_id: 'r', status: 'success', tenses: 'nope'});
  expect((await fetchTenseLibrary()).ok).toBe(false);
  respond(422, {
    request_id: 'r',
    status: 'failed',
    error: {code: 'ITEMS_NOT_AVAILABLE', message: 'x'},
  });
  expect((await learnItems(['pattern:gone'])).ok).toBe(false);
});
