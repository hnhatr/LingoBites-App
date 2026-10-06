import * as RNFS from '@dr.pogodin/react-native-fs';
/**
 * Canonical lesson download repository (LING-149 TASK-007, AD-005/AD-007).
 *
 * Each download is one atomic SQLite row (`lesson_downloads`): the whole
 * snapshot body is validated with the strict zod mirror before the single
 * `INSERT OR REPLACE`, so a truncated or invalid body leaves the prior row
 * untouched. Readers load exactly one row. Analyses fetched after the
 * download are never merged into the row (FR-016: "at download time").
 *
 * Media-block files are staged first into
 * `lesson-media/<lessonId>/<revision>/`; the row commit is the commit point,
 * and older revision directories plus orphans are swept after the commit and
 * at startup. A kill during the media fetch therefore leaves the prior copy
 * readable (INV-007).
 *
 * Deletion happens only on a positive `gone` from an HTTP 200 revisions
 * response (AD-007): network errors, 401 and 5xx keep the copy. Callers must
 * pass through `fetchLessonRevisions` success values; this module never
 * deletes on a transport failure.
 */
import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

import {getDatabase} from '@core/db/database';
import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
  parseLessonSnapshotResponse,
} from '@core/schemas/lesson';

import type {LessonDownloadStatus} from './canonicalLessonClient';

export const LESSON_MEDIA_ROOT_SEGMENT = 'lesson-media';

export type LessonDownloadRecord = {
  lessonId: string;
  contentRevision: number;
  /** Higher-than-stored revision seen by the status check ("có bản mới"). */
  serverRevision: number | null;
  contractVersion: number;
  snapshot: LessonSnapshot;
  mediaDir: string | null;
  downloadedAt: string;
};

export class InvalidLessonSnapshotError extends Error {
  constructor(message = 'Lesson snapshot response failed validation.') {
    super(message);
    this.name = 'InvalidLessonSnapshotError';
  }
}

type LessonDownloadRow = {
  lesson_id: string;
  content_revision: number;
  server_revision: number | null;
  contract_version: number;
  snapshot_json: string;
  media_dir: string | null;
  downloaded_at: string;
};

function firstRow<T>(result: {
  rows?: {length?: number; item: (index: number) => unknown} | null;
}): T | null {
  return (result.rows?.item(0) as T | undefined) ?? null;
}

function mapRow(row: LessonDownloadRow): LessonDownloadRecord | null {
  // The row stores the snapshot response body verbatim (AD-005); parse the
  // full body so a version drift surfaces instead of a half-parsed lesson.
  const parsed = LessonSnapshotResponseSchema.safeParse(
    JSON.parse(row.snapshot_json) as unknown,
  );
  if (!parsed.success) return null;
  if (parsed.data.lesson.id !== row.lesson_id) return null;
  return {
    lessonId: row.lesson_id,
    contentRevision: row.content_revision,
    serverRevision: row.server_revision,
    contractVersion: row.contract_version,
    snapshot: parsed.data.lesson,
    mediaDir: row.media_dir,
    downloadedAt: row.downloaded_at,
  };
}

/** Read exactly one stored row; `null` when absent or unparseable. */
export function getLessonDownload(
  lessonId: string,
  db: QuickSQLiteConnection = getDatabase(),
): LessonDownloadRecord | null {
  const row = firstRow<LessonDownloadRow>(
    db.execute('SELECT * FROM lesson_downloads WHERE lesson_id = ? LIMIT 1;', [
      lessonId,
    ]),
  );
  if (!row) return null;
  try {
    return mapRow(row);
  } catch {
    return null;
  }
}

/**
 * Parsing a snapshot (JSON + strict zod over every sentence) is the costly
 * part of listing downloads, and the Library lists them on each open. A row
 * only changes through a re-download (new `downloaded_at`/revision), so the
 * parsed record is reused while that stamp is unchanged.
 */
const parsedRowCache = new Map<
  string,
  {stamp: string; record: LessonDownloadRecord | null}
>();

function mapRowCached(row: LessonDownloadRow): LessonDownloadRecord | null {
  const stamp = `${row.content_revision}|${row.server_revision}|${row.downloaded_at}|${row.snapshot_json.length}`;
  const hit = parsedRowCache.get(row.lesson_id);
  if (hit && hit.stamp === stamp) return hit.record;
  const record = mapRow(row);
  parsedRowCache.set(row.lesson_id, {stamp, record});
  return record;
}

/** Every stored download, newest first. Unparseable rows are skipped. */
export function listLessonDownloads(
  db: QuickSQLiteConnection = getDatabase(),
): LessonDownloadRecord[] {
  const result = db.execute(
    'SELECT * FROM lesson_downloads ORDER BY downloaded_at DESC;',
  );
  const records: LessonDownloadRecord[] = [];
  const seen = new Set<string>();
  const length = result.rows?.length ?? 0;
  for (let index = 0; index < length; index += 1) {
    const row = result.rows?.item(index) as LessonDownloadRow | undefined;
    if (!row) continue;
    seen.add(row.lesson_id);
    try {
      const record = mapRowCached(row);
      if (record) records.push(record);
    } catch {
      // Skip a corrupt row without breaking the catalog.
    }
  }
  parsedRowCache.forEach((_, id) => {
    if (!seen.has(id)) parsedRowCache.delete(id);
  });
  return records;
}

export type SaveLessonSnapshotInput = {
  /** Raw `GET /api/v1/lessons/:id` body; validated before any write. */
  body: unknown;
  /** Relative media dir staged before the commit (or null when no media). */
  mediaDir?: string | null;
  now?: string;
};

/**
 * Validate the whole body, then write it with one `INSERT OR REPLACE`
 * statement. Throws `InvalidLessonSnapshotError` before touching the table,
 * so the old copy survives a failed redownload.
 */
export function saveLessonSnapshotBody(
  input: SaveLessonSnapshotInput,
  db: QuickSQLiteConnection = getDatabase(),
): LessonDownloadRecord {
  const parsed = parseLessonSnapshotResponse(input.body);
  if (!parsed.ok) {
    throw new InvalidLessonSnapshotError(parsed.message);
  }
  const snapshot = parsed.response.lesson;
  const now = input.now ?? new Date().toISOString();
  const mediaDir = input.mediaDir ?? null;
  db.execute(
    `INSERT OR REPLACE INTO lesson_downloads (
      lesson_id, content_revision, server_revision, contract_version,
      snapshot_json, media_dir, downloaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      snapshot.id,
      snapshot.content_revision,
      null,
      parsed.response.contract_version,
      JSON.stringify(input.body),
      mediaDir,
      now,
    ],
  );
  const stored = getLessonDownload(snapshot.id, db);
  if (!stored) {
    throw new InvalidLessonSnapshotError(
      'Downloaded snapshot is not readable.',
    );
  }
  return stored;
}

export type RevisionApplication = {
  removed: string[];
  markedUpdate: string[];
};

/**
 * Apply an HTTP 200 revisions response (AD-007): `gone` removes the download
 * (row only; media sweeping is the caller's `sweepLessonMedia` step), a
 * higher `content_revision` sets the `server_revision` update marker, an
 * equal revision clears it. Callers must only pass success values from
 * `fetchLessonRevisions` — never a transport failure.
 */
export function applyLessonRevisionStates(
  states: LessonDownloadStatus[],
  db: QuickSQLiteConnection = getDatabase(),
): RevisionApplication {
  const removed: string[] = [];
  const markedUpdate: string[] = [];
  for (const state of states) {
    if (state.state === 'gone') {
      db.execute('DELETE FROM lesson_downloads WHERE lesson_id = ?;', [
        state.lessonId,
      ]);
      removed.push(state.lessonId);
      continue;
    }
    if (state.contentRevision === null) continue;
    const row = firstRow<LessonDownloadRow>(
      db.execute(
        'SELECT * FROM lesson_downloads WHERE lesson_id = ? LIMIT 1;',
        [state.lessonId],
      ),
    );
    if (!row) continue;
    if (state.contentRevision > row.content_revision) {
      db.execute(
        'UPDATE lesson_downloads SET server_revision = ? WHERE lesson_id = ?;',
        [state.contentRevision, state.lessonId],
      );
      markedUpdate.push(state.lessonId);
    } else if (
      state.contentRevision <= row.content_revision &&
      row.server_revision !== null
    ) {
      db.execute(
        'UPDATE lesson_downloads SET server_revision = NULL WHERE lesson_id = ?;',
        [state.lessonId],
      );
    }
  }
  return {removed, markedUpdate};
}

/** Remove one download row. Media sweeping stays with `sweepLessonMedia`. */
export function removeLessonDownload(
  lessonId: string,
  db: QuickSQLiteConnection = getDatabase(),
): void {
  db.execute('DELETE FROM lesson_downloads WHERE lesson_id = ?;', [lessonId]);
}

/**
 * Relative media directory for one staged revision, e.g.
 * `lesson-media/<lessonId>/<revision>`.
 */
export function lessonMediaDirFor(lessonId: string, revision: number): string {
  return `${LESSON_MEDIA_ROOT_SEGMENT}/${lessonId}/${revision}`;
}

export type LessonMediaFileSystem = {
  documentDir: () => string | null;
  mkdir: (path: string) => Promise<void>;
  unlink: (path: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  readdir: (path: string) => Promise<string[]>;
  downloadFile: (url: string, destPath: string) => Promise<void>;
};

function deviceDocumentDir(): string | null {
  try {
    const base =
      typeof RNFS.DocumentDirectoryPath === 'string' &&
      RNFS.DocumentDirectoryPath.length > 0
        ? RNFS.DocumentDirectoryPath
        : null;
    return base;
  } catch {
    return null;
  }
}

async function defaultDownloadFile(
  url: string,
  destPath: string,
): Promise<void> {
  const result = await RNFS.downloadFile({fromUrl: url, toFile: destPath})
    .promise;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`Media download failed with HTTP ${result.statusCode}.`);
  }
}

async function defaultExists(path: string): Promise<boolean> {
  try {
    return await RNFS.exists(path);
  } catch {
    return false;
  }
}

async function defaultReaddir(path: string): Promise<string[]> {
  try {
    const entries = (await RNFS.readDir(path)) as Array<{name: string}>;
    return entries.map(entry => entry.name);
  } catch {
    return [];
  }
}

/** Production file-system binding (RNFS); tests inject a fake. */
export const defaultLessonMediaFileSystem: LessonMediaFileSystem = {
  documentDir: deviceDocumentDir,
  mkdir: async path => {
    await RNFS.mkdir(path);
  },
  unlink: async path => {
    await RNFS.unlink(path);
  },
  exists: defaultExists,
  readdir: defaultReaddir,
  downloadFile: defaultDownloadFile,
};

/**
 * Stage media-block remote URLs into `lesson-media/<lessonId>/<revision>/`
 * before the row commit. Throws on the first failure, leaving the prior
 * download row untouched; partial staged files are swept by
 * `sweepLessonMedia`.
 */
export async function stageLessonMedia(
  lessonId: string,
  revision: number,
  remoteUrls: string[],
  fs: LessonMediaFileSystem = defaultLessonMediaFileSystem,
): Promise<string | null> {
  if (remoteUrls.length === 0) return null;
  const base = fs.documentDir();
  if (!base) return null;
  const relativeDir = lessonMediaDirFor(lessonId, revision);
  const absoluteDir = `${base}/${relativeDir}`;
  await fs.mkdir(absoluteDir);
  for (let index = 0; index < remoteUrls.length; index += 1) {
    const url = remoteUrls[index];
    await fs.downloadFile(url, `${absoluteDir}/media-${index}`);
  }
  return relativeDir;
}

/**
 * Sweep media directories that no download row references, plus revision
 * directories older than the stored row. Runs after every commit and at
 * startup. Never touches the directory of the currently stored revision.
 */
export async function sweepLessonMedia(
  db: QuickSQLiteConnection = getDatabase(),
  fs: LessonMediaFileSystem = defaultLessonMediaFileSystem,
): Promise<{removed: string[]}> {
  const base = fs.documentDir();
  if (!base) return {removed: []};
  const referenced = new Set(
    listLessonDownloads(db)
      .map(record => record.mediaDir)
      .filter((dir): dir is string => dir !== null),
  );
  const root = `${base}/${LESSON_MEDIA_ROOT_SEGMENT}`;
  if (!(await fs.exists(root))) return {removed: []};
  const removed: string[] = [];
  const lessonIds = await fs.readdir(root);
  for (const lessonId of lessonIds) {
    const lessonDir = `${root}/${lessonId}`;
    let revisions: string[];
    try {
      revisions = await fs.readdir(lessonDir);
    } catch {
      continue;
    }
    for (const revision of revisions) {
      const relative = `${LESSON_MEDIA_ROOT_SEGMENT}/${lessonId}/${revision}`;
      if (!referenced.has(relative)) {
        try {
          await fs.unlink(`${base}/${relative}`);
          removed.push(relative);
        } catch {
          // Best-effort sweep; a locked file must not break startup.
        }
      }
    }
  }
  return {removed};
}
