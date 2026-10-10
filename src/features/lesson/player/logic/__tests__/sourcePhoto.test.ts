import {getAppConfig} from '@core/api/appConfig';

import {fetchSourcePhoto} from '../sourcePhoto';

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

describe('fetchSourcePhoto', () => {
  beforeEach(() => {
    (getAppConfig as jest.Mock).mockReturnValue({
      apiBaseUrl: 'https://api.test',
    });
    authenticatedFetch.mockReset();
  });

  it('returns an absolute link to the photo when the lesson has one', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {
        request_id: 'r',
        status: 'success',
        url: '/api/v1/learner-images/abc?exp=1&sig=s',
        width: 640,
        height: 480,
      }),
    );
    const result = await fetchSourcePhoto(LESSON);
    expect(authenticatedFetch.mock.calls[0][0]).toBe(
      `https://api.test/api/v1/lessons/${LESSON}/source-image`,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        uri: 'https://api.test/api/v1/learner-images/abc?exp=1&sig=s',
        width: 640,
        height: 480,
      },
    });
  });

  it('treats a lesson without a photo as no photo, not as an error', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(404, {
        status: 'failed',
        error: {code: 'IMAGE_NOT_FOUND', message: 'no'},
      }),
    );
    expect(await fetchSourcePhoto(LESSON)).toEqual({ok: true, value: null});
  });
});
