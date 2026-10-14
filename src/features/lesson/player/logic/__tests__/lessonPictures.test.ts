import {getAppConfig} from '@core/api/appConfig';

import {fetchLessonPictures} from '../lessonPictures';

jest.mock('@core/api/appConfig', () => ({getAppConfig: jest.fn()}));
jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));

const {authenticatedFetch} = jest.requireMock(
  '@core/api/authenticatedFetch',
) as {authenticatedFetch: jest.Mock};
const LESSON = '11111111-1111-4111-8111-111111111111';

function jsonResponse(status: number, body: unknown): Response {
  return {status, ok: status < 300, json: async () => body} as Response;
}

describe('fetchLessonPictures', () => {
  beforeEach(() => {
    (getAppConfig as jest.Mock).mockReturnValue({
      apiBaseUrl: 'https://api.test',
    });
    authenticatedFetch.mockReset();
  });

  it('reads the cover and the item pictures by item id', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {
        request_id: 'r',
        status: 'success',
        cover_url: 'https://cdn.test/unit.png',
        item_images: [{item_id: 'item-1', url: 'https://cdn.test/item.png'}],
      }),
    );
    const result = await fetchLessonPictures(LESSON);
    expect(authenticatedFetch.mock.calls[0][0]).toBe(
      `https://api.test/api/v1/lessons/${LESSON}/pictures`,
    );
    if (!result.ok) throw new Error('expected pictures');
    expect(result.value.coverUrl).toBe('https://cdn.test/unit.png');
    expect(result.value.itemImages.get('item-1')).toBe(
      'https://cdn.test/item.png',
    );
  });

  it('fails softly on an older server without the route', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(404, {status: 'failed', error: {code: 'NOT_FOUND'}}),
    );
    expect((await fetchLessonPictures(LESSON)).ok).toBe(false);
  });
});
