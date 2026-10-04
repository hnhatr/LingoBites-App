import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {saveShadowingAttempt} from '@features/speaking/logic/shadowing/saveShadowingAttempt';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222222';
const TAKE_A = '33333333-3333-4333-8333-333333333331';
const TAKE_B = '33333333-3333-4333-8333-333333333332';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const T0 = '2026-10-04T10:00:00.000Z';

let db: RealSqliteConnection;
let workingDirectory: string;

function input(takeId: string, filePath: string) {
  return {
    takeId,
    lessonId: LESSON_ID,
    sentenceId: SENTENCE_ID,
    filePath,
    durationMs: 1200,
    checkFullSentence: true,
    checkKeyWords: true,
    checkRhythm: true,
    sentence: {textEn: 'Hello', textVi: 'Xin chao', ipa: '/həˈloʊ/'},
    practicedAt: T0,
  };
}

describe('LING-245 INV-001 save rollback', () => {
  beforeEach(() => {
    workingDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ling245-inv001-'),
    );
    db = openRealSqlite(path.join(workingDirectory, 'state.sqlite'));
    resetDatabaseForTests(db);
    runMigrations(db);
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', USER_ID, T0],
    );
  });

  afterEach(() => {
    db.close();
    resetDatabaseForTests(null);
    fs.rmSync(workingDirectory, {recursive: true, force: true});
  });

  it('INV-001 HELD: a failed replacement keeps the prior row and audio file', () => {
    const oldFile = path.join(workingDirectory, 'old.m4a');
    const newFile = path.join(workingDirectory, 'new.m4a');
    fs.writeFileSync(oldFile, 'old-audio');
    fs.writeFileSync(newFile, 'new-audio');
    expect(saveShadowingAttempt(input(TAKE_A, oldFile)).ok).toBe(true);

    const replacement = saveShadowingAttempt(input(TAKE_B, newFile), {
      afterOutboxInsert: () => {
        throw new Error('injected transaction failure');
      },
    });

    expect(replacement.ok).toBe(false);
    const rows = db.execute(
      'SELECT id, file_path FROM speaking_recordings WHERE sentence_id = ?;',
      [SENTENCE_ID],
    ).rows;
    expect(rows?.length).toBe(1);
    expect(rows?.item(0)).toEqual({id: TAKE_A, file_path: oldFile});
    expect(fs.existsSync(oldFile)).toBe(true);
  });
});
