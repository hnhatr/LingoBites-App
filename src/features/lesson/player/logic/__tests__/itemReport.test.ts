import {getAppConfig} from '@core/api/appConfig';

import {reportLessonItem} from '../itemReport';

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

describe('reportLessonItem', () => {
  beforeEach(() => {
    (getAppConfig as jest.Mock).mockReturnValue({
      apiBaseUrl: 'https://api.test',
    });
    authenticatedFetch.mockReset();
  });

  it('posts the word code and reason, and encodes the code in the path', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(201, {request_id: 'r', status: 'success', recorded: true}),
    );
    const result = await reportLessonItem(
      LESSON,
      'word:orange juice',
      'wrong_meaning',
    );
    const [url, init] = authenticatedFetch.mock.calls[0];
    expect(url).toBe(
      `https://api.test/api/v1/lessons/${LESSON}/items/word%3Aorange%20juice/report`,
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({reason: 'wrong_meaning'});
    expect(result).toEqual({ok: true, value: {recorded: true}});
  });

  it('reports a repeat as not recorded again', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {request_id: 'r', status: 'success', recorded: false}),
    );
    expect(await reportLessonItem(LESSON, 'word:a', 'other')).toEqual({
      ok: true,
      value: {recorded: false},
    });
  });

  it('returns the server refusal, not a fake success', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(404, {
        status: 'failed',
        error: {code: 'REPORT_NOT_AVAILABLE', message: 'no'},
      }),
    );
    const result = await reportLessonItem(LESSON, 'word:a', 'other');
    expect(result.ok).toBe(false);
  });
});
