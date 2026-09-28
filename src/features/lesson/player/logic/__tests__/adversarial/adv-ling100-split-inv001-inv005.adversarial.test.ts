import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as AuthSession from '@shared/auth/authSession';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  insertPackageRecord,
  swapActivePackage,
} from '@features/lesson/packages/logic/data/ContentPackageRepository';
import {
  saveContentLesson,
  startContentLesson,
} from '@features/lesson/packages/logic/data/ContentLessonStateRepository';
import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@/test-support/adversarial/realSqlite';

/**
 * LING-100 adversarial review (TASK-011 learningClient split).
 *
 * ADV-H01 / INV-001: loading the split Public surfaces (curriculumLesson and
 * review barrels plus the moved consumers) must not open, migrate or mutate the
 * persisted learner database — no init drift from the new import graph. Real
 * `node:sqlite` file, production migrations and repositories.
 *
 * ADV-H02 / INV-005: every learner-progress mutation reached through the
 * `@modules/curriculumLesson` Public surface keeps the pre-split request
 * contract and issues exactly one request on retryable failures, so the split
 * cannot duplicate a server-side progress write.
 *
 * ADV-H03 / INV-005: the review client's duplicated transport/error mapping
 * agrees with the progress client on every error category and `retryable`
 * flag (the value callers use to decide whether to repeat a request).
 */

const NOW = '2026-09-27T12:00:00.000Z';
const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const EXERCISE_ID = '33333333-3333-4333-8333-333333333333';
const VOCABULARY_ID = '55555555-5555-4555-8555-555555555555';
const BASE_URL = 'http://localhost:3000';

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: 'abc123',
    session_id: '1',
    refresh_token: '2',
    access_expires_at: '2050',
    refresh_expires_at: '2050',
  },
  userId: 'user1',
};

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(body),
});

const failedBody = (code: string) => ({
  request_id: 'req-err',
  status: 'failed',
  error: {code, message: 'failed.'},
});

function fingerprint(db: RealSqliteConnection): string {
  const tables = (db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).rows?._array ?? []) as Array<{name: string}>;
  const dump: Record<string, unknown> = {};
  for (const {name} of tables) {
    dump[name] = db.execute(
      `SELECT * FROM "${name}" ORDER BY rowid`,
    ).rows?._array;
  }
  const schema = db.execute(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
  ).rows?._array;
  return JSON.stringify({schema, dump});
}

describe('ADV-H01 / INV-001: split Public surfaces do not touch persisted learner data (real SQLite)', () => {
  let dir: string;
  let dbFile: string;

  function coldStart(): RealSqliteConnection {
    const connection = openRealSqlite(dbFile);
    resetDatabaseForTests(connection);
    getDatabase();
    return connection;
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ling100-adv-split-'));
    dbFile = path.join(dir, 'lingobites.sqlite');
  });

  afterEach(() => {
    resetDatabaseForTests(null);
    fs.rmSync(dir, {recursive: true, force: true});
  });

  it('ADV-H01 / INV-001: catalog and lesson progress are byte-identical after loading the split modules and a cold restart', () => {
    let db = coldStart();
    insertPackageRecord({
      id: 'pkg-a',
      slug: 'v1',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/v1.zip',
      sha256: 'a',
      importedAt: NOW,
      isActive: true,
    });
    insertPackageRecord({
      id: 'pkg-b',
      slug: 'v2',
      schemaVersion: '0.1.0',
      sourceUrl: 'https://example.com/v2.zip',
      sha256: 'b',
      importedAt: NOW,
      isActive: false,
    });
    swapActivePackage('pkg-b', NOW);
    saveContentLesson({lessonId: 'lesson-adv', now: NOW});
    startContentLesson({lessonId: 'lesson-adv', now: NOW});
    const before = fingerprint(db);

    jest.isolateModules(() => {
      // Bind the fresh registry's database singleton to the same real file so
      // any module-load side effect of the split surfaces lands on it.
      require('@shared/db/database').resetDatabaseForTests(db);
      const curriculumLesson = require('@features/lesson/player');
      const review = require('@features/review');
      require('@features/review/logic/useLearningReview');
      expect(typeof curriculumLesson.startLessonFromConfirmedText).toBe(
        'function',
      );
      expect(typeof curriculumLesson.submitExerciseAttempt).toBe('function');
      expect(typeof review.fetchReview).toBe('function');
    });
    expect(before).toContain('lesson-adv');
    expect(before).toContain('pkg-b');
    expect(fingerprint(db)).toBe(before);

    db.close();
    db = coldStart();
    runMigrations(getDatabase());
    expect(fingerprint(db)).toBe(before);
    db.close();
  });
});

describe('ADV-H02 / INV-005: progress writes through the curriculumLesson Public surface', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const {
    startLessonProgress,
    completeLessonProgress,
    submitExerciseAttempt,
    markVocabularySeen,
    setVocabularyProgress,
  } = require('@features/lesson/player');

  const writes: Array<{
    name: string;
    call: (fetchImpl: jest.Mock) => Promise<{ok: boolean}>;
    method: string;
    url: string;
    body: string | undefined;
  }> = [
    {
      name: 'startLessonProgress',
      call: fetchImpl => startLessonProgress(LESSON_ID, {fetchImpl}),
      method: 'POST',
      url: `${BASE_URL}/v1/lessons/${LESSON_ID}/start`,
      body: undefined,
    },
    {
      name: 'completeLessonProgress',
      call: fetchImpl => completeLessonProgress(LESSON_ID, {fetchImpl}),
      method: 'POST',
      url: `${BASE_URL}/v1/lessons/${LESSON_ID}/complete`,
      body: undefined,
    },
    {
      name: 'submitExerciseAttempt',
      call: fetchImpl =>
        submitExerciseAttempt(EXERCISE_ID, {choice: 'a'}, {fetchImpl}),
      method: 'POST',
      url: `${BASE_URL}/v1/exercises/${EXERCISE_ID}/attempts`,
      body: JSON.stringify({answer: {choice: 'a'}}),
    },
    {
      name: 'markVocabularySeen',
      call: fetchImpl => markVocabularySeen(VOCABULARY_ID, {fetchImpl}),
      method: 'POST',
      url: `${BASE_URL}/v1/vocabularies/${VOCABULARY_ID}/seen`,
      body: undefined,
    },
    {
      name: 'setVocabularyProgress',
      call: fetchImpl =>
        setVocabularyProgress(VOCABULARY_ID, 'known', {fetchImpl}),
      method: 'PUT',
      url: `${BASE_URL}/v1/vocabularies/${VOCABULARY_ID}/progress`,
      body: JSON.stringify({status: 'known'}),
    },
  ];

  const failures: Array<{label: string; fetchImpl: () => jest.Mock}> = [
    {
      label: '500',
      fetchImpl: () =>
        jest
          .fn()
          .mockResolvedValue(
            jsonResponse(failedBody('EXERCISE_EVALUATION_UNAVAILABLE'), 500),
          ),
    },
    {
      label: '503',
      fetchImpl: () =>
        jest
          .fn()
          .mockResolvedValue(jsonResponse(failedBody('DB_UNAVAILABLE'), 503)),
    },
    {
      label: '409 MERGE_IN_PROGRESS',
      fetchImpl: () =>
        jest
          .fn()
          .mockResolvedValue(
            jsonResponse(failedBody('MERGE_IN_PROGRESS'), 409),
          ),
    },
    {
      label: 'transport rejection (unknown outcome)',
      fetchImpl: () =>
        jest.fn().mockRejectedValue(new TypeError('Network request failed')),
    },
  ];

  it.each(writes)(
    'ADV-H02 / INV-005: $name keeps the pre-split method/path/body',
    async ({call, method, url, body}) => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValue(jsonResponse(failedBody('LESSON_NOT_FOUND'), 404));
      await call(fetchImpl);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [calledUrl, init] = fetchImpl.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(calledUrl).toBe(url);
      expect(init.method).toBe(method);
      expect(init.body).toBe(body);
    },
  );

  for (const write of writes) {
    it.each(failures)(
      `ADV-H02 / INV-005: ${write.name} sends exactly one request on $label (no hidden duplicate write)`,
      async ({fetchImpl: makeFetch}) => {
        const fetchImpl = makeFetch();
        const result = await write.call(fetchImpl);
        expect(result.ok).toBe(false);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
      },
    );
  }
});

describe('ADV-H03 / INV-005: review and progress clients agree on error categories and retryable', () => {
  beforeEach(() => {
    jest
      .spyOn(AuthSession, 'ensureValidSession')
      .mockResolvedValue(validSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const {listLessonProgress} = require('@features/lesson/player');
  const {fetchReview} = require('@features/review');

  const cases: Array<{label: string; status: number; body: unknown}> = [
    {label: '403', status: 403, body: failedBody('FORBIDDEN')},
    {label: '404 coded', status: 404, body: failedBody('EXERCISE_NOT_FOUND')},
    {label: '409 merge', status: 409, body: failedBody('MERGE_IN_PROGRESS')},
    {
      label: '409 not started',
      status: 409,
      body: failedBody('LESSON_NOT_STARTED'),
    },
    {label: '400', status: 400, body: failedBody('VALIDATION_FAILED')},
    {label: '422', status: 422, body: failedBody('EXERCISE_ANSWER_INVALID')},
    {label: '429', status: 429, body: failedBody('RATE_LIMITED')},
    {label: '500', status: 500, body: failedBody('INTERNAL')},
    {label: '503', status: 503, body: failedBody('DB_UNAVAILABLE')},
    {label: '418 unreadable', status: 418, body: undefined},
    {label: '502 unreadable', status: 502, body: undefined},
  ];

  it.each(cases)(
    'ADV-H03 / INV-005: $label maps identically in both clients',
    async ({status, body}) => {
      const progress = await listLessonProgress({
        fetchImpl: jest.fn().mockResolvedValue(jsonResponse(body, status)),
      });
      const reviewResult = await fetchReview({
        fetchImpl: jest.fn().mockResolvedValue(jsonResponse(body, status)),
      });
      expect(reviewResult).toEqual(progress);
    },
  );

  it('ADV-H03 / INV-005: transport rejection and abort map identically in both clients', async () => {
    const reject = () =>
      jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    expect(await fetchReview({fetchImpl: reject()})).toEqual(
      await listLessonProgress({fetchImpl: reject()}),
    );
    const controller = new AbortController();
    controller.abort();
    const never = jest.fn();
    expect(
      await fetchReview({fetchImpl: never, signal: controller.signal}),
    ).toEqual(
      await listLessonProgress({fetchImpl: never, signal: controller.signal}),
    );
    expect(never).not.toHaveBeenCalled();
  });
});
