import {getDatabase} from '@core/db/database';
import type {LessonSnapshot} from '@core/schemas/lesson';

/**
 * The learner's choice about downloading lesson media (images, audio) for
 * offline study (docs/superpowers/plans/2026-10-10-offline-download-consent.md).
 *
 * The lesson text is always stored, since offline study, review and progress
 * read it. Media files are heavier and are only downloaded with consent:
 * `auto` downloads them when a lesson opens online, `manual` only when the
 * learner taps "Tải để học offline". `undecided` downloads nothing.
 */
export const MEDIA_DOWNLOAD_CONSENT_KEY = 'downloads.media_consent';
export const MEDIA_DOWNLOAD_CONSENT_ASKED_AT_KEY =
  'downloads.media_consent_asked_at';
export const MEDIA_DOWNLOAD_CONSENT_ASK_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;

export type MediaDownloadConsent = 'auto' | 'manual' | 'undecided';

function readSetting(key: string): string | null {
  const row = getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string, now: string): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, value, now],
  );
}

export function readMediaDownloadConsent(): MediaDownloadConsent {
  const value = readSetting(MEDIA_DOWNLOAD_CONSENT_KEY);
  return value === 'auto' || value === 'manual' ? value : 'undecided';
}

/** Records the learner's answer (consent sheet or the settings row). */
export function setMediaDownloadConsent(
  value: 'auto' | 'manual',
  now: Date = new Date(),
): void {
  const at = now.toISOString();
  writeSetting(MEDIA_DOWNLOAD_CONSENT_KEY, value, at);
  writeSetting(MEDIA_DOWNLOAD_CONSENT_ASKED_AT_KEY, at, at);
}

/** "Để sau": stays undecided, asked again after 7 days. */
export function postponeMediaDownloadConsent(now: Date = new Date()): void {
  const at = now.toISOString();
  writeSetting(MEDIA_DOWNLOAD_CONSENT_ASKED_AT_KEY, at, at);
}

/** Remote URLs of the snapshot's media blocks, in block order. */
export function lessonMediaUrls(snapshot: LessonSnapshot): string[] {
  const urls: string[] = [];
  for (const block of snapshot.blocks) {
    if (block.type !== 'media') continue;
    const url = (block.data as Record<string, unknown>).url;
    if (typeof url === 'string' && url.length > 0) urls.push(url);
  }
  return urls;
}

/**
 * Ask only for a lesson that has media, while undecided, and not again
 * within 7 days of "Để sau".
 */
export function shouldAskMediaDownloadConsent(
  snapshot: LessonSnapshot,
  now: Date = new Date(),
): boolean {
  if (lessonMediaUrls(snapshot).length === 0) return false;
  if (readMediaDownloadConsent() !== 'undecided') return false;
  const askedAt = Date.parse(
    readSetting(MEDIA_DOWNLOAD_CONSENT_ASKED_AT_KEY) ?? '',
  );
  return (
    !Number.isFinite(askedAt) ||
    now.getTime() - askedAt >= MEDIA_DOWNLOAD_CONSENT_ASK_AGAIN_MS
  );
}
