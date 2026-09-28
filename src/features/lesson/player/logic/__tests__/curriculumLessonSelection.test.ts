import * as AuthSession from '@shared/auth/authSession';
import {fetchPublishedCurriculumLessons} from '../curriculumLessonSelection';

const BASE = 'http://localhost:3000';

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: 'test-token',
    session_id: '1',
    refresh_token: '2',
    access_expires_at: '2050',
    refresh_expires_at: '2050',
  },
  userId: 'user1',
};

const course = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'english-basics',
  title: 'English Basics',
  description: 'Basics course',
  sourceLanguage: 'vi',
  targetLanguage: 'en',
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const level = {
  id: '00000000-0000-4000-8000-000000000002',
  courseId: course.id,
  code: 'A1',
  title: 'Beginner',
  description: 'Beginner level',
  position: 0,
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const unit = {
  id: '00000000-0000-4000-8000-000000000003',
  levelId: level.id,
  slug: 'greetings',
  title: 'Greetings',
  description: 'Greetings unit',
  position: 0,
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function lessonEntry(id: string, position: number) {
  return {
    id,
    unitId: unit.id,
    slug: `lesson-${position}`,
    title: `Lesson ${position}`,
    description: `Description ${position}`,
    position,
    estimatedMinutes: 7,
    status: 'published',
    publishedAt: '2026-01-02T00:00:00Z',
    contentRevision: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };
}

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(body),
});

/** Route fetch calls to canned metadata envelopes by exact path. */
function metadataFetchImpl(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    [`${BASE}/v1/courses`]: {
      request_id: 'req-courses',
      status: 'success',
      courses: [course],
    },
    [`${BASE}/v1/courses/${course.slug}/levels`]: {
      request_id: 'req-levels',
      status: 'success',
      levels: [level],
    },
    [`${BASE}/v1/levels/${level.id}/units`]: {
      request_id: 'req-units',
      status: 'success',
      units: [unit],
    },
    [`${BASE}/v1/units/${unit.id}/lessons`]: {
      request_id: 'req-lessons',
      status: 'success',
      lessons: [
        lessonEntry('00000000-0000-4000-8000-000000000010', 1),
        lessonEntry('00000000-0000-4000-8000-000000000011', 0),
      ],
    },
    ...overrides,
  };
  const impl: jest.Mock = jest.fn(async (url: string) => {
    const body = routes[url];
    if (body === undefined) {
      return jsonResponse({request_id: 'x', status: 'failed'}, 404);
    }
    if (body instanceof Error) {
      throw body;
    }
    return jsonResponse(body);
  });
  return impl;
}

describe('fetchPublishedCurriculumLessons', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('walks the existing public hierarchy with exact paths', async () => {
    const fetchImpl = metadataFetchImpl();
    const result = await fetchPublishedCurriculumLessons({fetchImpl});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const urls = fetchImpl.mock.calls.map(call => call[0] as string);
    expect(urls).toContain(`${BASE}/v1/courses`);
    expect(urls).toContain(`${BASE}/v1/courses/${course.slug}/levels`);
    expect(urls).toContain(`${BASE}/v1/levels/${level.id}/units`);
    expect(urls).toContain(`${BASE}/v1/units/${unit.id}/lessons`);
    // Ordered by Server position, with hierarchy context attached.
    expect(result.lessons.map(entry => entry.id)).toEqual([
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000010',
    ]);
    expect(result.lessons[0]).toMatchObject({
      title: 'Lesson 0',
      estimatedMinutes: 7,
      courseTitle: 'English Basics',
      levelTitle: 'Beginner',
      unitTitle: 'Greetings',
    });
  });

  it('returns an empty list when no courses are published', async () => {
    const fetchImpl = metadataFetchImpl({
      [`${BASE}/v1/courses`]: {
        request_id: 'req-empty',
        status: 'success',
        courses: [],
      },
    });
    const result = await fetchPublishedCurriculumLessons({fetchImpl});
    expect(result).toEqual({ok: true, lessons: []});
  });

  it('skips an unreachable subtree instead of failing the walk', async () => {
    const fetchImpl = metadataFetchImpl({
      [`${BASE}/v1/units/${unit.id}/lessons`]: new Error('socket hang up'),
    });
    const result = await fetchPublishedCurriculumLessons({fetchImpl});
    expect(result).toEqual({ok: true, lessons: []});
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/v1/courses'),
      expect.anything(),
    );
  });

  it('skips a malformed hop instead of throwing', async () => {
    const fetchImpl = metadataFetchImpl({
      [`${BASE}/v1/levels/${level.id}/units`]: {
        request_id: 'req-bad',
        status: 'success',
        units: [{id: 'not-a-lesson'}],
      },
    });
    const result = await fetchPublishedCurriculumLessons({fetchImpl});
    expect(result).toEqual({ok: true, lessons: []});
  });

  it('reports cancellation when the walk is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await fetchPublishedCurriculumLessons({
      fetchImpl: metadataFetchImpl(),
      signal: controller.signal,
    });
    expect(result).toEqual({ok: false, reason: 'cancelled'});
  });
});
