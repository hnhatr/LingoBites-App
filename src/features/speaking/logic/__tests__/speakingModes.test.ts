/**
 * Tests for Speaking Room mode listing + shadowing content aggregation
 * (LING-149 TASK-008: canonical `lesson_downloads` sentences).
 */

import {open} from 'react-native-quick-sqlite';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {seedCanonicalLessonDownload} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {getShadowingContent, listSpeakingRoomModes} from '../speakingModes';

function setup() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

function seedDownloadedLessonWithSentences() {
  seedCanonicalLessonDownload();
}

describe('listSpeakingRoomModes', () => {
  beforeEach(() => setup());

  it('always lists all six required modes', () => {
    const modes = listSpeakingRoomModes();
    expect(modes.map(m => m.mode)).toEqual([
      'shadowing',
      'quick_answer',
      'standup',
      'app_description',
      'bug_report',
      'mock_interview',
    ]);
  });

  it('flags every mode unavailable when no downloads exist', () => {
    const modes = listSpeakingRoomModes();
    expect(modes.every(m => !m.available)).toBe(true);
  });

  it('flags shadowing available once downloaded sentences exist', () => {
    seedDownloadedLessonWithSentences();

    const modes = listSpeakingRoomModes();
    const shadowing = modes.find(m => m.mode === 'shadowing');
    expect(shadowing?.available).toBe(true);
  });
});

describe('getShadowingContent', () => {
  beforeEach(() => setup());

  it('returns lines built from downloaded lesson sentences', () => {
    seedDownloadedLessonWithSentences();

    const content = getShadowingContent();
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].lines.length).toBeGreaterThan(0);
    expect(content[0].lines[0]).toMatchObject({
      textEn: expect.any(String),
      textVi: expect.any(String),
    });
  });

  it('returns an empty list when nothing is installed', () => {
    expect(getShadowingContent()).toEqual([]);
  });
});
