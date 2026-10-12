import {fetchWordPack, fetchWordPath, learnWordPack} from '../wordPathClient';

/** Vocab path P5: the word path client validates what the Server sends and reports failures as values. */

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const PACK_ID = '0b1f6c1e-2d3a-4b5c-8d9e-111111111111';

const pathBody = {
  request_id: 'r',
  status: 'success',
  levels: [
    {
      cefr_level: 'A1',
      topics: [
        {
          topic_code: null,
          title_vi: 'chung',
          packs: [
            {id: PACK_ID, position: 1, title_vi: 'Gói A1 1', item_count: 12},
          ],
        },
      ],
    },
  ],
};

function respond(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: {'Content-Type': 'application/json'},
    }),
  );
}

beforeEach(() => {
  mockFetch.mockReset();
});

it('reads the word path', async () => {
  respond(200, pathBody);
  const result = await fetchWordPath();
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.levels[0]?.topics[0]?.packs[0]?.item_count).toBe(12);
  }
  expect(String(mockFetch.mock.calls[0]?.[0])).toMatch(/\/v1\/word-path$/);
});

it('reports a body that does not match the contract', async () => {
  respond(200, {request_id: 'r', status: 'success'});
  const result = await fetchWordPath();
  expect(result).toMatchObject({ok: false, kind: 'contract-mismatch'});
});

it('reports a missing pack as not-found', async () => {
  respond(404, {status: 'failed'});
  const result = await fetchWordPack(PACK_ID);
  expect(result).toMatchObject({ok: false, kind: 'not-found'});
});

it('sends the learn mode and the codes', async () => {
  respond(200, {
    request_id: 'r',
    status: 'success',
    enrolled: 2,
    already_scheduled: 0,
  });
  const result = await learnWordPack(PACK_ID, {
    itemCodes: ['word:coffee', 'word:tea'],
    mode: 'known',
  });
  expect(result).toEqual({
    ok: true,
    value: {
      request_id: 'r',
      status: 'success',
      enrolled: 2,
      already_scheduled: 0,
    },
  });
  const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({
    item_codes: ['word:coffee', 'word:tea'],
    mode: 'known',
  });
});

it('treats a server error as a value', async () => {
  respond(500, {status: 'failed'});
  const result = await learnWordPack(PACK_ID, {
    itemCodes: ['word:coffee'],
    mode: 'learn',
  });
  expect(result).toMatchObject({ok: false, kind: 'server-error'});
});
