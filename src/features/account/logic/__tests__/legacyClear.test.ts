import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {deleteLocalFiles} from '@core/localData/localFileCleanup';
import {clearLessonTokens} from '@core/security/lessonTokenStore';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {listSpeakingRecordingFilePaths} from '../../../speaking/logic/data/SpeakingRepository';
import {
  CANONICAL_LEGACY_CLEAR_MARKER,
  CANONICAL_LEGACY_TABLES_TO_DROP,
  executeCanonicalLegacyClear,
  executeLegacyClear,
  LEGACY_CLEAR_MARKER,
} from '../legacyClear';

jest.mock('@core/security/lessonTokenStore');
jest.mock('@core/localData/localFileCleanup');
jest.mock('../../../speaking/logic/data/SpeakingRepository', () => ({
  listSpeakingRecordingFilePaths: jest.fn(),
}));

const V1_LESSON_ID = 'lesson-v1-1';
const V2_LESSON_ID = 'lesson-v2-1';
const CREATED_AT = '2026-09-14T00:00:00.000Z';

function getCount(db: any, query: string, params: any[] = []): number {
  const result = db.execute(query, params);
  const row = result.rows?.item(0);
  return row?.count ?? 0;
}

function countRows(db: any, query: string, params: any[] = []): number {
  const result = db.execute(query, params);
  return result.rows?.length ?? 0;
}

/** v3 migrations drop legacy lesson tables; recreate them for clear tests. */
function restoreLegacyLessonTablesForTest(db: {
  execute: (sql: string, params?: unknown[]) => unknown;
}): void {
  db.execute('CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY);');
  db.execute(
    'CREATE TABLE IF NOT EXISTS lesson_v2 (lesson_id TEXT PRIMARY KEY);',
  );
  db.execute(
    'CREATE TABLE IF NOT EXISTS lesson_v2_sentences (lesson_id TEXT, sentence_id TEXT);',
  );
  db.execute(
    'CREATE TABLE IF NOT EXISTS lesson_v2_chunks (lesson_id TEXT, chunk_id TEXT);',
  );
  db.execute(
    'CREATE TABLE IF NOT EXISTS lesson_v2_vocabulary (lesson_id TEXT, vocabulary_id TEXT);',
  );
  db.execute(
    'CREATE TABLE IF NOT EXISTS lesson_v2_grammar (lesson_id TEXT, grammar_id TEXT);',
  );
  db.execute(
    'CREATE TABLE IF NOT EXISTS lesson_v2_units (lesson_id TEXT, unit_id TEXT);',
  );
}

/** Seeds one v1 lesson row plus a full v2 lesson (parent + 5 child rows). */
function seedLessonFixtures(db: any): void {
  restoreLegacyLessonTablesForTest(db);
  db.execute(
    'INSERT INTO lessons (id, anonymous_user_id, lesson_input_hash, title, source_type, confirmed_text, vietnamese_translation, level, ai_output_json, is_saved, created_at, updated_at, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [
      V1_LESSON_ID,
      'anon1',
      'hash1',
      'title',
      'paste_text',
      'text',
      'trans',
      'A1',
      '{}',
      0,
      CREATED_AT,
      CREATED_AT,
      'vocabulary',
    ],
  );
  db.execute(
    `INSERT OR REPLACE INTO lesson_v2 (
      lesson_id, anonymous_user_id, input_hash, schema_version, request_id,
      status, revision, source_text, word_count, char_count,
      detected_language, title, level, prompt_version, is_saved,
      warnings_json, error_json, practice_json, expires_at, created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      V2_LESSON_ID,
      'anon1',
      'hash-v2',
      1,
      'req-1',
      'ready',
      1,
      'hello world',
      2,
      11,
      'en',
      'v2 title',
      'A1',
      'pv1',
      0,
      '[]',
      null,
      '{}',
      null,
      CREATED_AT,
      CREATED_AT,
    ],
  );
  db.execute(
    'INSERT INTO lesson_v2_sentences (lesson_id, sentence_id, idx, text, char_start, char_end, chunk_id, status, translation, simple_meaning, phrases_json, tts_json, related_vocabulary_ids_json, related_grammar_ids_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [
      V2_LESSON_ID,
      's1',
      0,
      'hello',
      0,
      5,
      'c1',
      'ready',
      'xin chào',
      'chào',
      '[]',
      '{}',
      '[]',
      '[]',
      CREATED_AT,
    ],
  );
  db.execute(
    'INSERT INTO lesson_v2_chunks (lesson_id, chunk_id, idx, sentence_ids_json, status, attempts, error_code, retryable) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
    [V2_LESSON_ID, 'c1', 0, '["s1"]', 'ready', 1, null, 0],
  );
  db.execute(
    'INSERT INTO lesson_v2_vocabulary (lesson_id, vocab_id, word, phrase_from_text, word_type, meaning_vi, ipa, ipa_source, source_sentence_id, example, example_translation, tts_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [
      V2_LESSON_ID,
      'w1',
      'hello',
      'hello',
      'interjection',
      'xin chào',
      'həˈloʊ',
      'ai',
      's1',
      'hello!',
      'xin chào!',
      '{}',
    ],
  );
  db.execute(
    'INSERT INTO lesson_v2_grammar (lesson_id, grammar_id, name, name_vi, pattern, found_in_sentence_id, found_in_text, explanation_vi, beginner_tip, examples_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [
      V2_LESSON_ID,
      'g1',
      'greeting',
      'chào hỏi',
      'hello',
      's1',
      'hello',
      'lời chào',
      'tip',
      '[]',
    ],
  );
  db.execute(
    'INSERT INTO lesson_v2_units (lesson_id, unit_key, status, attempts, error_code, retryable) VALUES (?, ?, ?, ?, ?, ?);',
    [V2_LESSON_ID, 'vocabulary', 'ready', 1, null, 0],
  );
}

const V2_TABLES = [
  'lesson_v2',
  'lesson_v2_sentences',
  'lesson_v2_chunks',
  'lesson_v2_vocabulary',
  'lesson_v2_grammar',
  'lesson_v2_units',
] as const;

/** Row counts for the seven quarantined v1/v2 lesson tables. */
function lessonRowCounts(db: any): Record<string, number> {
  const counts: Record<string, number> = {
    lessons: countRows(
      db,
      'SELECT * FROM lessons ORDER BY datetime(created_at) DESC;',
    ),
  };
  for (const table of V2_TABLES) {
    counts[table] = countRows(
      db,
      `SELECT * FROM ${table} WHERE lesson_id = ?;`,
      [V2_LESSON_ID],
    );
  }
  return counts;
}

function expectAllOne(counts: Record<string, number>): void {
  for (const table of ['lessons', ...V2_TABLES]) {
    expect(counts[table]).toBe(1);
  }
}

describe('executeLegacyClear', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
    jest.clearAllMocks();
    (listSpeakingRecordingFilePaths as jest.Mock).mockReturnValue([
      '/path/to/file.mp4',
    ]);
  });

  it('preserves v1/v2 lesson rows and tokens while clearing non-lesson surfaces', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);
    db.execute(
      `INSERT INTO sync_outbox (id, event_type, entity_id, payload_json, created_at, attempt_count, last_error, synced_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, NULL);`,
      ['out-legacy', 'review', 'entity-1', '{}', CREATED_AT],
    );
    db.execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['legacy_key', '1', CREATED_AT],
    );
    db.execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', 'user1', CREATED_AT],
    );

    const before = lessonRowCounts(db);
    expectAllOne(before);

    await executeLegacyClear();

    // Checkpoint A quarantine: every lesson row survives.
    const after = lessonRowCounts(db);
    expect(after).toEqual(before);
    expectAllOne(after);

    // Lesson capability tokens are never touched pre-parity.
    expect(clearLessonTokens).not.toHaveBeenCalled();

    // Unrelated cleanup still runs.
    expect(deleteLocalFiles).toHaveBeenCalledWith(['/path/to/file.mp4']);
    expect(
      countRows(db, 'SELECT * FROM sync_outbox WHERE id = ?;', ['out-legacy']),
    ).toBe(0);
    expect(
      getCount(db, 'SELECT COUNT(*) as count FROM app_settings WHERE key = ?', [
        'legacy_key',
      ]),
    ).toBe(0);
    expect(
      getCount(db, 'SELECT COUNT(*) as count FROM app_settings WHERE key = ?', [
        'current_account_id',
      ]),
    ).toBe(1);
    expect(
      getCount(db, 'SELECT COUNT(*) as count FROM app_settings WHERE key = ?', [
        LEGACY_CLEAR_MARKER,
      ]),
    ).toBe(1);

    // The old marker is written, but it is NOT canonical cleanup evidence.
    expect(
      getCount(db, 'SELECT COUNT(*) as count FROM app_settings WHERE key = ?', [
        CANONICAL_LEGACY_CLEAR_MARKER,
      ]),
    ).toBe(0);
  });

  it('is idempotent: repeated runs are no-ops and never record canonical evidence', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);

    await executeLegacyClear();
    jest.clearAllMocks();

    await executeLegacyClear();

    expect(clearLessonTokens).not.toHaveBeenCalled();
    expect(deleteLocalFiles).not.toHaveBeenCalled();
    expectAllOne(lessonRowCounts(db));
    expect(
      getCount(db, 'SELECT COUNT(*) as count FROM app_settings WHERE key = ?', [
        CANONICAL_LEGACY_CLEAR_MARKER,
      ]),
    ).toBe(0);
  });

  it('a pre-existing old marker short-circuits without canonical evidence', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);
    db.execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [LEGACY_CLEAR_MARKER, '1', CREATED_AT],
    );

    await executeLegacyClear();

    expect(clearLessonTokens).not.toHaveBeenCalled();
    expect(deleteLocalFiles).not.toHaveBeenCalled();
    expectAllOne(lessonRowCounts(db));
    expect(
      getCount(db, 'SELECT COUNT(*) as count FROM app_settings WHERE key = ?', [
        CANONICAL_LEGACY_CLEAR_MARKER,
      ]),
    ).toBe(0);
  });

  it('preserves lesson rows when a non-lesson delete fails', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);
    const realExecute = db.execute.bind(db);
    const spy = jest
      .spyOn(db, 'execute')
      .mockImplementation(
        (sql: string, params?: Array<string | number | null>) => {
          if (sql.toLowerCase().includes('delete from flashcards')) {
            throw new Error('SQLITE_IOERR');
          }
          return realExecute(sql, params as never);
        },
      );

    try {
      await expect(executeLegacyClear()).rejects.toThrow('SQLITE_IOERR');
    } finally {
      spy.mockRestore();
    }

    expectAllOne(lessonRowCounts(db));
    expect(clearLessonTokens).not.toHaveBeenCalled();
    expect(
      getCount(db, 'SELECT COUNT(*) as count FROM app_settings WHERE key = ?', [
        CANONICAL_LEGACY_CLEAR_MARKER,
      ]),
    ).toBe(0);
  });
});

describe('executeCanonicalLegacyClear', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
    jest.clearAllMocks();
    (clearLessonTokens as jest.Mock).mockResolvedValue(undefined);
  });

  it('throws when authorization reference is missing or whitespace', async () => {
    await expect(
      executeCanonicalLegacyClear({authorizationRef: ''}),
    ).rejects.toThrow(
      'Explicit Checkpoint B authorization reference required for canonical legacy cleanup',
    );

    await expect(executeCanonicalLegacyClear(undefined as any)).rejects.toThrow(
      'Explicit Checkpoint B authorization reference required for canonical legacy cleanup',
    );
  });

  it('transactionally drops all seven legacy tables and clears tokens when authorized', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);

    db.execute(
      'INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi, is_saved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      ['fc1', V1_LESSON_ID, 'v1', 'word', 'nghĩa', 0, CREATED_AT, CREATED_AT],
    );

    const result = await executeCanonicalLegacyClear({
      authorizationRef: '01a0de32-7f74-7145-a78f-a546b4b5d54b',
    });

    expect(result).toEqual({
      ok: true,
      alreadyCleared: false,
      clearedTokenCount: 2,
      droppedTablesCount: 7,
    });

    expect(clearLessonTokens).toHaveBeenCalledTimes(1);
    const clearedIds = (clearLessonTokens as jest.Mock).mock.calls[0][0];
    expect(clearedIds.sort()).toEqual([V1_LESSON_ID, V2_LESSON_ID].sort());

    for (const table of CANONICAL_LEGACY_TABLES_TO_DROP) {
      const check = db.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [table],
      );
      expect(check.rows?.length ?? 0).toBe(0);
    }

    const markerRow = db.execute(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [CANONICAL_LEGACY_CLEAR_MARKER],
    );
    expect(markerRow.rows?.item(0)?.value).toBe(
      '01a0de32-7f74-7145-a78f-a546b4b5d54b',
    );

    expect(
      countRows(db, 'SELECT * FROM flashcards WHERE id = ?;', ['fc1']),
    ).toBe(1);
  });

  it('is idempotent and short-circuits when marker is present', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);
    db.execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [
        CANONICAL_LEGACY_CLEAR_MARKER,
        '01a0de32-7f74-7145-a78f-a546b4b5d54b',
        CREATED_AT,
      ],
    );

    const result = await executeCanonicalLegacyClear({
      authorizationRef: '01a0de32-7f74-7145-a78f-a546b4b5d54b',
    });

    expect(result).toEqual({
      ok: true,
      alreadyCleared: true,
      clearedTokenCount: 0,
      droppedTablesCount: 0,
    });

    expect(clearLessonTokens).not.toHaveBeenCalled();
    expectAllOne(lessonRowCounts(db));
  });

  it('aborts before database table drops if token cleanup fails', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);

    (clearLessonTokens as jest.Mock).mockRejectedValueOnce(
      new Error('KEYCHAIN_UNAVAILABLE'),
    );

    await expect(
      executeCanonicalLegacyClear({authorizationRef: 'AUTH-FAIL'}),
    ).rejects.toThrow('KEYCHAIN_UNAVAILABLE');

    expectAllOne(lessonRowCounts(db));

    const markerCheck = db.execute(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [CANONICAL_LEGACY_CLEAR_MARKER],
    );
    expect(markerCheck.rows?.length ?? 0).toBe(0);
  });

  it('rolls back database transaction if a drop operation fails', async () => {
    const db = getDatabase();
    seedLessonFixtures(db);

    const realExecute = db.execute.bind(db);
    const spy = jest
      .spyOn(db, 'execute')
      .mockImplementation(
        (sql: string, params?: Array<string | number | null>) => {
          if (
            sql.toLowerCase().includes('drop table if exists lesson_v2_units')
          ) {
            throw new Error('SQLITE_BUSY');
          }
          return realExecute(sql, params as never);
        },
      );

    try {
      await expect(
        executeCanonicalLegacyClear({authorizationRef: 'AUTH-DROP-FAIL'}),
      ).rejects.toThrow('SQLITE_BUSY');
    } finally {
      spy.mockRestore();
    }

    expectAllOne(lessonRowCounts(db));

    const markerCheck = db.execute(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [CANONICAL_LEGACY_CLEAR_MARKER],
    );
    expect(markerCheck.rows?.length ?? 0).toBe(0);

    const retryResult = await executeCanonicalLegacyClear({
      authorizationRef: 'AUTH-RETRY',
    });
    expect(retryResult.ok).toBe(true);
    expect(retryResult.alreadyCleared).toBe(false);
  });
});
