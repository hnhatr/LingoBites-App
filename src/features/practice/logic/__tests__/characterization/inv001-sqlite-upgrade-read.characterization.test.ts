import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {getPracticeSet, savePracticeSet} from '../../data/PracticeRepository';
import {
  CHARACTERIZATION_INVARIANTS,
  simulateDatabaseProcessRestart,
} from '@test/support/characterization/index';
import type {PracticeSet} from '@core/schemas/practice';

const mockSet: PracticeSet = {
  id: 'char-set-1',
  contract_version: 1,
  status: 'ready',
  lesson_id: 'lesson-char',
  lesson_revision: 1,
  source_fingerprint: 'fp-char',
  config_hash: 'hash-char',
  difficulty: 'beginner',
  requested_count: 1,
  set_revision: 1,
  generator: {
    provider: 'test',
    model: 'test',
    prompt_version: 'v1',
    generator_version: 'v1',
  },
  questions: [],
  created_at: '2026-09-27T00:00:00.000Z',
  ready_at: '2026-09-27T00:01:00.000Z',
};

describe(`${CHARACTERIZATION_INVARIANTS.INV_001} SQLite upgrade-read`, () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    getDatabase();
  });

  it('keeps persisted practice rows readable after restart and idempotent migrations', () => {
    savePracticeSet(mockSet);

    simulateDatabaseProcessRestart();
    expect(getPracticeSet('char-set-1')?.lesson_id).toBe('lesson-char');

    runMigrations(getDatabase());
    expect(getPracticeSet('char-set-1')).toMatchObject({
      id: 'char-set-1',
      lesson_id: 'lesson-char',
      status: 'ready',
    });
  });
});
