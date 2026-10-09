import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  isSpeakingActivity,
  NO_SPEAKING_MS,
  noSpeakingActive,
  startNoSpeaking,
  stopNoSpeaking,
} from '../noSpeaking';

/** PR 14 (decision H8): "Không nói được lúc này" lasts 15 minutes. */
beforeEach(() => {
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('turns speaking off for 15 minutes, or until the learner says so', () => {
  const now = Date.parse('2026-10-09T10:00:00.000Z');
  expect(noSpeakingActive(now)).toBe(false);
  startNoSpeaking(now);
  expect(noSpeakingActive(now + NO_SPEAKING_MS - 1)).toBe(true);
  expect(noSpeakingActive(now + NO_SPEAKING_MS)).toBe(false);
  startNoSpeaking(now);
  stopNoSpeaking();
  expect(noSpeakingActive(now)).toBe(false);
});

it('knows which activities need speaking', () => {
  expect(isSpeakingActivity('speaking_drill')).toBe(true);
  expect(isSpeakingActivity('listen_and_repeat')).toBe(true);
  expect(isSpeakingActivity('fill_blank')).toBe(false);
});
