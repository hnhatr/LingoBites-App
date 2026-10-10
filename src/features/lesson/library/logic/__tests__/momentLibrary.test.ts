import {getAppConfig} from '@core/api/appConfig';

import {lessonBelongsToSection, LIBRARY_SECTIONS} from '../librarySections';
import {fetchMomentLibrary} from '../momentLibrary';

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

describe('moment library', () => {
  beforeEach(() => {
    (getAppConfig as jest.Mock).mockReturnValue({
      apiBaseUrl: 'https://api.test',
    });
    authenticatedFetch.mockReset();
  });

  it('maps the server list and makes the thumbnail link absolute', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {
        request_id: 'r',
        status: 'success',
        moments: [
          {
            lesson_id: LESSON,
            title: 'Gọi đồ uống',
            moment_intent: 'use',
            situation_title_vi: 'Gọi đồ uống',
            created_at: '2026-10-10T08:00:00.000Z',
            thumbnail_url: '/api/v1/learner-images/abc?exp=1&sig=s',
          },
        ],
      }),
    );
    const result = await fetchMomentLibrary();
    expect(result).toEqual({
      ok: true,
      value: [
        {
          lessonId: LESSON,
          title: 'Gọi đồ uống',
          intent: 'use',
          situationTitleVi: 'Gọi đồ uống',
          createdAt: '2026-10-10T08:00:00.000Z',
          thumbnailUri:
            'https://api.test/api/v1/learner-images/abc?exp=1&sig=s',
        },
      ],
    });
  });

  it('keeps moment lessons out of "mine" so each lesson sits under one card', () => {
    const mine = LIBRARY_SECTIONS.find(section => section.id === 'mine')!;
    const moments = LIBRARY_SECTIONS.find(section => section.id === 'moments')!;
    const situation = {
      origin: 'learner' as const,
      sourceType: 'learner_situation' as const,
    };
    expect(lessonBelongsToSection(mine, situation)).toBe(false);
    expect(moments.moments).toBe(true);
  });
});
