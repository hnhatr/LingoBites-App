import {fetchChapterAudioManifest} from '../audioManifestClient';

function response(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe('fetchChapterAudioManifest', () => {
  it('parses a valid manifest for the requested chapter', async () => {
    const fetchFn = jest.fn(async () =>
      response(true, {
        chapter_id: 'ch1',
        assets: [
          {
            id: 'a1',
            url: 'https://cdn.example.com/a1.mp3',
            bytes: 2048,
            checksum: 'sha256-a1',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const result = await fetchChapterAudioManifest('ch1', fetchFn);

    expect(result).toEqual({
      ok: true,
      manifest: {
        chapterId: 'ch1',
        assets: [
          {
            id: 'a1',
            url: 'https://cdn.example.com/a1.mp3',
            bytes: 2048,
            checksum: 'sha256-a1',
          },
        ],
      },
    });
  });

  it('accepts an empty asset list', async () => {
    const fetchFn = jest.fn(async () =>
      response(true, {chapter_id: 'ch1', assets: []}),
    ) as unknown as typeof fetch;

    const result = await fetchChapterAudioManifest('ch1', fetchFn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.assets).toEqual([]);
    }
  });

  it('returns NETWORK_ERROR when the request throws', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    const result = await fetchChapterAudioManifest('ch1', fetchFn);

    expect(result).toMatchObject({ok: false, errorCode: 'NETWORK_ERROR'});
  });

  it('returns SERVER_ERROR on a non-ok response', async () => {
    const fetchFn = jest.fn(async () =>
      response(false, {status: 'failed'}),
    ) as unknown as typeof fetch;

    const result = await fetchChapterAudioManifest('ch1', fetchFn);

    expect(result).toMatchObject({ok: false, errorCode: 'SERVER_ERROR'});
  });

  it('rejects a manifest for a different chapter id', async () => {
    const fetchFn = jest.fn(async () =>
      response(true, {chapter_id: 'other', assets: []}),
    ) as unknown as typeof fetch;

    const result = await fetchChapterAudioManifest('ch1', fetchFn);

    expect(result).toMatchObject({ok: false, errorCode: 'INVALID_MANIFEST'});
  });

  it('rejects assets with missing or invalid fields', async () => {
    const fetchFn = jest.fn(async () =>
      response(true, {
        chapter_id: 'ch1',
        assets: [{id: 'a1', url: '', bytes: -1, checksum: 'sha256-a1'}],
      }),
    ) as unknown as typeof fetch;

    const result = await fetchChapterAudioManifest('ch1', fetchFn);

    expect(result).toMatchObject({ok: false, errorCode: 'INVALID_MANIFEST'});
  });
});
