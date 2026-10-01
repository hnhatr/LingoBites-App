import {insertPendingChapterAudioAsset} from '@features/audio/logic/data/AudioAssetRepository';

import type {AuthSession} from '@core/auth/authTypes';
import {getActiveSessionId, setActiveSessionId} from '@core/auth/sessionStore';
import {getDatabase} from '@core/db/database';

import {
  DEFAULT_CANONICAL_LESSON_ID,
  readSeededLessonDownload,
} from '@test/support/canonicalDownloadSeed';
import {
  P2_SESSION_A,
  P2_USER_A,
  type P2HarnessContext,
  seedSession,
  setupP2RealInfraHarness,
  teardownP2RealInfraHarness,
  writeP2LearnerData,
} from '@test/support/realInfra/harness';

const M4_AUDIO_NOW = '2026-09-28T08:00:00.000Z';

export type M4HarnessContext = P2HarnessContext;

export function setupM4AccountIsolationHarness(): M4HarnessContext {
  return setupP2RealInfraHarness();
}

export function teardownM4AccountIsolationHarness(): void {
  teardownP2RealInfraHarness();
}

export function writeM4RelocatedDomainLearnerData(): void {
  writeP2LearnerData();
  insertPendingChapterAudioAsset({
    chapterId: 'chapter-m4-a',
    now: M4_AUDIO_NOW,
    asset: {
      id: 'audio-m4-a',
      url: 'https://example.test/audio-m4-a.mp3',
      bytes: 4096,
      checksum: 'sha256:m4-a',
    },
  });
}

export function countAudioAssetRows(): number {
  const row = getDatabase()
    .execute('SELECT COUNT(*) AS c FROM audio_assets;')
    .rows?.item(0) as {c: number};
  return Number(row.c);
}

export function expectM4YoutubeRowPresent(): void {
  expect(readSeededLessonDownload(DEFAULT_CANONICAL_LESSON_ID)).not.toBeNull();
}

export function expectM4RelocatedDomainCleared(): void {
  expect(readSeededLessonDownload(DEFAULT_CANONICAL_LESSON_ID)).toBeNull();
  expect(countAudioAssetRows()).toBe(0);
}

export function expiredSessionA(): AuthSession {
  return {
    ...P2_SESSION_A,
    access_expires_at: new Date(Date.now() - 60_000).toISOString(),
  };
}

export async function seedExpiredActiveSessionA(): Promise<void> {
  const session = expiredSessionA();
  await seedSession(session, P2_USER_A.id);
  await setActiveSessionId(session.session_id);
}

export function fetchUrlPaths(mockFetch: jest.Mock): string[] {
  return mockFetch.mock.calls.map(([url]) => String(url));
}

export function expectPersistedSessionRestoreBoot(mockFetch: jest.Mock): void {
  const paths = fetchUrlPaths(mockFetch);
  expect(paths.some(path => path.endsWith('/v1/me'))).toBe(true);
  expect(paths.some(path => path.endsWith('/v1/auth/bootstrap'))).toBe(false);
}

export async function expectSignedOutWithClearedActivePointer(): Promise<void> {
  await expect(getActiveSessionId()).resolves.toEqual({
    ok: true,
    value: null,
  });
}
