import {readFileSync} from 'fs';
import {join} from 'path';

import {getAppConfig} from '@core/api/appConfig';

import {
  fetchCourseLevels,
  fetchCourses,
  fetchLevelUnits,
  fetchUnitLessons,
  fetchUnitSummativeTask,
} from '../courseClient';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));

const {authenticatedFetch} = jest.requireMock(
  '@core/api/authenticatedFetch',
) as {authenticatedFetch: jest.Mock};

const COURSE_ID = '11111111-1111-4111-8111-111111111111';
const LEVEL_ID = '22222222-2222-4222-8222-222222222222';
const UNIT_ID = '33333333-3333-4333-8333-333333333333';

function jsonResponse(status: number, body: unknown): Response {
  return {status, json: async () => body} as Response;
}

const timestamps = {
  status: 'published',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function lesson(id: string, position: number) {
  return {
    id,
    unitId: UNIT_ID,
    slug: `lesson-${position}`,
    title: `Lesson ${position}`,
    description: '',
    position,
    estimatedMinutes: null,
    publishedAt: '2026-10-01T00:00:00.000Z',
    contentRevision: 1,
    origin: 'admin',
    ownerUserId: null,
    ...timestamps,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getAppConfig as jest.Mock).mockReturnValue({
    apiBaseUrl: 'https://api.example',
  });
});

describe('courseClient (F14 curriculum routes)', () => {
  it('lists published courses from GET /v1/courses', async () => {
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {
        request_id: 'r1',
        status: 'success',
        courses: [
          {
            id: COURSE_ID,
            slug: 'english-a1',
            title: 'English A1',
            description: 'Start here',
            sourceLanguage: 'vi',
            targetLanguage: 'en',
            ...timestamps,
          },
        ],
      }),
    );

    const result = await fetchCourses();

    expect(authenticatedFetch.mock.calls[0][0]).toBe(
      'https://api.example/v1/courses',
    );
    expect(result).toEqual({
      ok: true,
      value: [expect.objectContaining({id: COURSE_ID, slug: 'english-a1'})],
    });
  });

  it('reads levels by course slug and sorts them by position', async () => {
    const level = (id: string, position: number) => ({
      id,
      courseId: COURSE_ID,
      code: `L${position}`,
      title: `Level ${position}`,
      description: '',
      position,
      ...timestamps,
    });
    authenticatedFetch.mockResolvedValue(
      jsonResponse(200, {
        request_id: 'r2',
        status: 'success',
        levels: [level('b', 2), level('a', 1)],
      }),
    );

    const result = await fetchCourseLevels('english a1');

    expect(authenticatedFetch.mock.calls[0][0]).toBe(
      'https://api.example/v1/courses/english%20a1/levels',
    );
    expect(result.ok && result.value.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('reads units by level id and lessons by unit id', async () => {
    authenticatedFetch
      .mockResolvedValueOnce(
        jsonResponse(200, {
          request_id: 'r3',
          status: 'success',
          units: [
            {
              id: UNIT_ID,
              levelId: LEVEL_ID,
              slug: 'greetings',
              title: 'Greetings',
              description: '',
              position: 0,
              ...timestamps,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          request_id: 'r4',
          status: 'success',
          lessons: [lesson('second', 1), lesson('first', 0)],
        }),
      );

    const units = await fetchLevelUnits(LEVEL_ID);
    const lessons = await fetchUnitLessons(UNIT_ID);

    expect(authenticatedFetch.mock.calls.map(call => call[0])).toEqual([
      `https://api.example/v1/levels/${LEVEL_ID}/units`,
      `https://api.example/v1/units/${UNIT_ID}/lessons`,
    ]);
    expect(units.ok && units.value[0].id).toBe(UNIT_ID);
    // Older servers send no specification: it reads as empty.
    expect(units.ok && units.value[0].canDo).toEqual([]);
    expect(units.ok && units.value[0].audience).toBe('all');
    expect(lessons.ok && lessons.value.map(item => item.id)).toEqual([
      'first',
      'second',
    ]);
  });

  it('maps HTTP errors, invalid bodies and network failures', async () => {
    authenticatedFetch.mockResolvedValueOnce(jsonResponse(503, {}));
    expect(await fetchCourses()).toMatchObject({
      ok: false,
      kind: 'server-error',
      status: 503,
    });

    authenticatedFetch.mockResolvedValueOnce(
      jsonResponse(200, {courses: [{id: 1}]}),
    );
    expect(await fetchCourses()).toMatchObject({
      ok: false,
      kind: 'content-error',
    });

    authenticatedFetch.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchCourses()).toMatchObject({
      ok: false,
      kind: 'network-error',
    });
  });

  it('does not call the network when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await fetchCourses({signal: controller.signal});

    expect(authenticatedFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ok: false, cancelled: true});
  });
});

describe('unit summative task (PR 16)', () => {
  it('reads the Server fixture and a unit without a task', async () => {
    const body = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '../../../../core/schemas/__tests__/fixtures/valid-unit-summative-task-response.json',
        ),
        'utf8',
      ),
    ) as {task: {id: string}};
    authenticatedFetch.mockResolvedValueOnce(jsonResponse(200, body));
    const result = await fetchUnitSummativeTask(UNIT_ID);
    expect(authenticatedFetch.mock.calls[0]?.[0]).toBe(
      `https://api.example/v1/units/${UNIT_ID}/summative-task`,
    );
    expect(result).toMatchObject({ok: true, value: {id: body.task.id}});

    authenticatedFetch.mockResolvedValueOnce(
      jsonResponse(200, {...body, task: null}),
    );
    await expect(fetchUnitSummativeTask(UNIT_ID)).resolves.toEqual({
      ok: true,
      value: null,
    });
  });
});
