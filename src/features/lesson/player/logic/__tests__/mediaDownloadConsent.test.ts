import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  type LessonSnapshot,
  parseLessonSnapshotResponse,
} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {
  canonicalLessonBody,
  SEED_MEDIA_URL,
} from '@test/support/canonicalDownloadSeed';

import {
  lessonMediaUrls,
  MEDIA_DOWNLOAD_CONSENT_ASK_AGAIN_MS,
  MEDIA_DOWNLOAD_CONSENT_KEY,
  postponeMediaDownloadConsent,
  readMediaDownloadConsent,
  setMediaDownloadConsent,
  shouldAskMediaDownloadConsent,
} from '../mediaDownloadConsent';

function snapshot(withMedia: boolean): LessonSnapshot {
  const body = canonicalLessonBody({withMedia});
  const parsed = parseLessonSnapshotResponse(body);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.response.lesson;
}

const NOW = new Date('2026-10-10T08:00:00.000Z');

describe('mediaDownloadConsent', () => {
  beforeEach(() => {
    const db = openRealSqlite(':memory:');
    runMigrations(db);
    resetDatabaseForTests(db);
  });

  afterEach(() => {
    resetDatabaseForTests(null);
  });

  it('is undecided until the learner answers', () => {
    expect(readMediaDownloadConsent()).toBe('undecided');
    setMediaDownloadConsent('manual', NOW);
    expect(readMediaDownloadConsent()).toBe('manual');
    setMediaDownloadConsent('auto', NOW);
    expect(readMediaDownloadConsent()).toBe('auto');
  });

  it('treats an unknown stored value as undecided', () => {
    getDatabase().execute(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [MEDIA_DOWNLOAD_CONSENT_KEY, 'yes', NOW.toISOString()],
    );
    expect(readMediaDownloadConsent()).toBe('undecided');
  });

  it('lists the media block urls only', () => {
    expect(lessonMediaUrls(snapshot(false))).toEqual([]);
    expect(lessonMediaUrls(snapshot(true))).toEqual([SEED_MEDIA_URL]);
  });

  it('asks only for a lesson with media while undecided', () => {
    expect(shouldAskMediaDownloadConsent(snapshot(false), NOW)).toBe(false);
    expect(shouldAskMediaDownloadConsent(snapshot(true), NOW)).toBe(true);
    setMediaDownloadConsent('manual', NOW);
    expect(shouldAskMediaDownloadConsent(snapshot(true), NOW)).toBe(false);
  });

  it('asks again 7 days after "Để sau"', () => {
    postponeMediaDownloadConsent(NOW);
    expect(readMediaDownloadConsent()).toBe('undecided');
    const soon = new Date(NOW.getTime() + 60_000);
    expect(shouldAskMediaDownloadConsent(snapshot(true), soon)).toBe(false);
    const later = new Date(NOW.getTime() + MEDIA_DOWNLOAD_CONSENT_ASK_AGAIN_MS);
    expect(shouldAskMediaDownloadConsent(snapshot(true), later)).toBe(true);
  });
});
