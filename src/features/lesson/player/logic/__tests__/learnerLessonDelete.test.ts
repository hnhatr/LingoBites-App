import {getAppConfig} from '@core/api/appConfig';

import {deleteLearnerLesson} from '../learnerLessonDelete';

jest.mock('@core/api/appConfig', () => ({getAppConfig: jest.fn()}));
jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));
jest.mock('../canonicalDownloadRepository', () => ({
  removeLessonDownload: jest.fn(),
}));

const {authenticatedFetch} = jest.requireMock(
  '@core/api/authenticatedFetch',
) as {authenticatedFetch: jest.Mock};
const {removeLessonDownload} = jest.requireMock(
  '../canonicalDownloadRepository',
) as {removeLessonDownload: jest.Mock};
const LESSON = '11111111-1111-4111-8111-111111111111';

function jsonResponse(status: number, body: unknown): Response {
  return {status, ok: status < 300, json: async () => body} as Response;
}

describe('deleteLearnerLesson', () => {
  beforeEach(() => {
    (getAppConfig as jest.Mock).mockReturnValue({
      apiBaseUrl: 'https://api.test',
    });
    authenticatedFetch.mockReset();
    removeLessonDownload.mockReset();
  });

  it('deletes on the server and then drops this device copy', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {status: 'success', removed: [LESSON]}),
    );
    const result = await deleteLearnerLesson(LESSON);
    expect(result).toEqual({ok: true, value: undefined});
    expect(authenticatedFetch.mock.calls[0][0]).toBe(
      `https://api.test/api/v1/lessons/${LESSON}`,
    );
    expect(authenticatedFetch.mock.calls[0][1].method).toBe('DELETE');
    expect(removeLessonDownload).toHaveBeenCalledWith(LESSON);
  });

  it('keeps the device copy when the server refuses', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(404, {
        status: 'failed',
        error: {code: 'LESSON_NOT_FOUND', message: 'no'},
      }),
    );
    const result = await deleteLearnerLesson(LESSON);
    expect(result).toMatchObject({ok: false, kind: 'not-found'});
    expect(removeLessonDownload).not.toHaveBeenCalled();
  });
});
