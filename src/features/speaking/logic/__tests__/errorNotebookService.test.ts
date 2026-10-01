/**
 * Tests for automatic Error Notebook capture (SETE-110 / M5, REQ-28/29, VC-18).
 */

import {open} from 'react-native-quick-sqlite';

import {listErrorEvents} from '@features/speaking/logic/data/SpeakingRepository';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {
  captureSpeakingErrorIfNeeded,
  classifySpeakingAttempt,
} from '../errorNotebookService';

function setup() {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-08T00:00:00.000Z'));
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

describe('classifySpeakingAttempt', () => {
  it('returns null for a strong attempt — no error is captured', () => {
    expect(
      classifySpeakingAttempt({
        taskCompleted: true,
        keyPhraseUsed: true,
        responseTimeMs: 1000,
      }),
    ).toBeNull();
  });

  it('prioritizes listening over other signals', () => {
    expect(
      classifySpeakingAttempt({
        taskCompleted: false,
        keyPhraseUsed: false,
        listeningMiss: true,
      }),
    ).toBe('listening');
  });

  it('classifies missed key phrase as vocabulary', () => {
    expect(
      classifySpeakingAttempt({taskCompleted: true, keyPhraseUsed: false}),
    ).toBe('vocabulary');
  });

  it('classifies incomplete task (with key phrase used) as structure', () => {
    expect(
      classifySpeakingAttempt({taskCompleted: false, keyPhraseUsed: true}),
    ).toBe('structure');
  });

  it('classifies a slow-but-complete attempt as slow_response', () => {
    expect(
      classifySpeakingAttempt({
        taskCompleted: true,
        keyPhraseUsed: true,
        responseTimeMs: 9000,
      }),
    ).toBe('slow_response');
  });
});

describe('captureSpeakingErrorIfNeeded', () => {
  beforeEach(() => setup());

  it('does nothing for a strong attempt', () => {
    const result = captureSpeakingErrorIfNeeded({
      id: 'attempt-1',
      source: 'speaking_room',
      outcome: {taskCompleted: true, keyPhraseUsed: true, responseTimeMs: 500},
    });
    expect(result).toBeNull();
    expect(listErrorEvents()).toHaveLength(0);
  });

  it('automatically captures an error event with no manual add-flashcard step', () => {
    const result = captureSpeakingErrorIfNeeded({
      id: 'attempt-1',
      source: 'speaking_room',
      lessonId: 'lesson-1',
      activityId: 'activity-1',
      outcome: {taskCompleted: true, keyPhraseUsed: false},
    });

    expect(result).toMatchObject({id: 'attempt-1', category: 'vocabulary'});
    expect(listErrorEvents('lesson-1')).toHaveLength(1);
    expect(listErrorEvents('lesson-1')[0].reviewItemId).toBeTruthy();
  });
});
